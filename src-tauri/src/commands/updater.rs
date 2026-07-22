use std::path::{Path, PathBuf};

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::invoke_error::{invoke_err_msg, InvokeErrorDto};

const UPDATE_PUBKEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEIwREYwMEU4RDI3MjgzNDYKUldSR2czTFM2QURmc0lZVlg0WU5vcGJGUG5CZmRBOTNlT1BxV0VSbWs0WGRGd2FLdkkwS1hEZFQK";

const MANIFEST_URL: &str = "https://github.com/yourpov/Sys-Assistant/releases/latest/download/update.json";

const OLD_SUFFIX: &str = ".old";

#[derive(Deserialize)]
struct UpdateManifest {
    version: String,
    #[serde(default)]
    notes: Option<String>,
    url: String,
    signature: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfoDto {
    pub version: String,
    pub notes: Option<String>,
    pub url: String,
    pub signature: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
}

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<UpdateInfoDto>, InvokeErrorDto> {
    let manifest = fetch_manifest().await?;
    let current = app.package_info().version.to_string();

    if is_newer(&manifest.version, &current) {
        Ok(Some(UpdateInfoDto {
            version: manifest.version,
            notes: manifest.notes,
            url: manifest.url,
            signature: manifest.signature,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn download_and_apply_update(app: AppHandle, url: String, signature: String) -> Result<(), InvokeErrorDto> {
    let current_exe = std::env::current_exe()
        .map_err(|e| update_err_msg("update_apply_failed", "This update couldn't be applied", e.to_string()))?;
    let dir = current_exe
        .parent()
        .ok_or_else(|| update_err_msg("update_apply_failed", "This update couldn't be applied", "the app has no parent folder"))?;

    let bytes = download(&app, &url).await?;

    verify_signature(&bytes, &signature)?;

    let staged = dir.join("automate.update.tmp");
    tokio::fs::write(&staged, &bytes)
        .await
        .map_err(|e| update_err_msg("update_apply_failed", "This update couldn't be saved", format!("write staged binary: {e}. Make sure the app's folder is writable.")))?;

    let old = old_path(&current_exe);
    let _ = tokio::fs::remove_file(&old).await;

    if let Err(e) = tokio::fs::rename(&current_exe, &old).await {
        let _ = tokio::fs::remove_file(&staged).await;
        return Err(update_err_msg(
            "update_apply_failed",
            "This update couldn't be applied",
            format!("move current binary aside: {e}. Make sure the app's folder is writable and no copy is running from it."),
        ));
    }

    if let Err(e) = tokio::fs::rename(&staged, &current_exe).await {
        let _ = tokio::fs::rename(&old, &current_exe).await;
        let _ = tokio::fs::remove_file(&staged).await;
        return Err(update_err_msg(
            "update_apply_failed",
            "This update couldn't be applied",
            format!("move new binary into place: {e}"),
        ));
    }

    Ok(())
}

pub fn cleanup_old_binary() {
    if let Ok(exe) = std::env::current_exe() {
        let _ = std::fs::remove_file(old_path(&exe));
    }
}

async fn fetch_manifest() -> Result<UpdateManifest, InvokeErrorDto> {
    let resp = reqwest::Client::new()
        .get(MANIFEST_URL)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| update_err_msg("update_check_failed", "Couldn't check for updates", e.to_string()))?;

    if !resp.status().is_success() {
        return Err(update_err_msg(
            "update_check_failed",
            "Couldn't check for updates",
            format!("manifest request returned {}", resp.status()),
        ));
    }

    resp.json::<UpdateManifest>()
        .await
        .map_err(|e| update_err_msg("update_check_failed", "Couldn't check for updates", format!("read manifest: {e}")))
}

async fn download(app: &AppHandle, url: &str) -> Result<Vec<u8>, InvokeErrorDto> {
    let mut resp = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| update_err_msg("update_download_failed", "The update couldn't be downloaded", e.to_string()))?;

    if !resp.status().is_success() {
        return Err(update_err_msg(
            "update_download_failed",
            "The update couldn't be downloaded",
            format!("download returned {}", resp.status()),
        ));
    }

    let total = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut buf: Vec<u8> = Vec::with_capacity(total as usize);

    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| update_err_msg("update_download_failed", "The update couldn't be downloaded", e.to_string()))?
    {
        downloaded += chunk.len() as u64;
        buf.extend_from_slice(&chunk);
        let _ = app.emit("update://progress", DownloadProgress { downloaded, total });
    }

    Ok(buf)
}

fn verify_signature(bytes: &[u8], signature_b64: &str) -> Result<(), InvokeErrorDto> {
    use minisign_verify::{PublicKey, Signature};

    let signature_failed = |log: String| {
        invoke_err_msg(
            "update_signature_failed",
            "This update couldn't be verified",
            "The download didn't match its signature and was not applied. Try again, or download the latest version manually.",
            log,
        )
    };

    let pubkey_file = decode_base64_utf8(UPDATE_PUBKEY).map_err(|e| signature_failed(format!("decode pubkey: {e}")))?;
    let pubkey_line = pubkey_file
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .ok_or_else(|| signature_failed("pubkey is empty".into()))?;
    let public_key = PublicKey::from_base64(pubkey_line.trim()).map_err(|e| signature_failed(format!("parse pubkey: {e}")))?;

    let sig_file = decode_base64_utf8(signature_b64).map_err(|e| signature_failed(format!("decode signature: {e}")))?;
    let signature = Signature::decode(&sig_file).map_err(|e| signature_failed(format!("parse signature: {e}")))?;

    public_key
        .verify(bytes, &signature, false)
        .map_err(|e| signature_failed(format!("verify: {e}")))
}

fn decode_base64_utf8(input: &str) -> Result<String, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(input.trim())
        .map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map_err(|e| e.to_string())
}

fn old_path(exe: &Path) -> PathBuf {
    let mut name = exe.as_os_str().to_os_string();
    name.push(OLD_SUFFIX);
    PathBuf::from(name)
}

fn is_newer(candidate: &str, current: &str) -> bool {
    match (semver::Version::parse(candidate.trim()), semver::Version::parse(current.trim())) {
        (Ok(candidate), Ok(current)) => candidate > current,
        _ => false,
    }
}

fn update_err_msg(code: &str, title: &str, log: impl Into<String>) -> InvokeErrorDto {
    invoke_err_msg(
        code,
        title,
        "Try again in a moment. If it keeps failing, download the latest version manually.",
        log,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newer_version_is_detected() {
        assert!(is_newer("0.5.1", "0.5.0"));
        assert!(is_newer("0.6.0", "0.5.9"));
        assert!(is_newer("1.0.0", "0.9.9"));
    }

    #[test]
    fn same_or_older_version_is_not_an_update() {
        assert!(!is_newer("0.5.0", "0.5.0"));
        assert!(!is_newer("0.4.9", "0.5.0"));
    }

    #[test]
    fn unparseable_versions_never_trigger_an_update() {
        assert!(!is_newer("not-a-version", "0.5.0"));
        assert!(!is_newer("0.5.1", "garbage"));
    }

    #[test]
    fn configured_pubkey_parses() {
        use minisign_verify::PublicKey;
        let pubkey_file = decode_base64_utf8(UPDATE_PUBKEY).expect("pubkey base64 decodes");
        let pubkey_line = pubkey_file.lines().rev().find(|l| !l.trim().is_empty()).expect("pubkey has a key line");
        PublicKey::from_base64(pubkey_line.trim()).expect("pubkey line parses");
    }

    #[test]
    fn old_path_appends_suffix() {
        let p = old_path(Path::new("C:/Users/me/Desktop/automate.exe"));
        assert!(p.to_string_lossy().ends_with("automate.exe.old"));
    }
}
