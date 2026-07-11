use std::io::SeekFrom;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use serde::Deserialize;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

use crate::dto::ValorantVersionDto;
use crate::error::AppError;

const LATEST_VERSION_CACHE_TTL: Duration = Duration::from_secs(3600);
const VERSION_LOG_MAX_BYTES: u64         = 2 * 1024 * 1024;

static LATEST_VERSION_CACHE: LazyLock<Mutex<Option<(Instant, ValorantVersionDto)>>> = LazyLock::new(|| Mutex::new(None));

#[derive(Debug, Deserialize)]
struct VersionResponse {
    data: VersionData,
}

#[derive(Debug, Deserialize)]
struct VersionData {
    branch              : String,
    version             : String,
    #[serde(rename = "buildVersion")]
    build_version       : String,
    #[serde(rename = "riotClientVersion")]
    riot_client_version : String,
}

pub async fn latest_riot_client_version() -> Result<String, AppError> {
    Ok(fetch_latest_version().await?.riot_client_version)
}

pub async fn riot_client_version_for_requests() -> Result<String, AppError> {
    if let Ok(version) = fetch_latest_version().await {
        return Ok(version.riot_client_version);
    }
    if let Some(local) = fetch_local_version().await {
        return Ok(local.riot_client_version);
    }
    Err(AppError::RiotClient(
        "couldn't determine the valorant client version. open valorant once, then try again".into(),
    ))
}

pub async fn fetch_version_status() -> (Option<ValorantVersionDto>, Option<ValorantVersionDto>) {
    let latest = fetch_latest_version().await.ok();
    let local = fetch_local_version().await;
    (latest, local)
}

async fn fetch_latest_version() -> Result<ValorantVersionDto, AppError> {
    if let Some((inserted, version)) = LATEST_VERSION_CACHE.lock().unwrap().as_ref() {
        if inserted.elapsed() < LATEST_VERSION_CACHE_TTL {
            return Ok(version.clone());
        }
    }

    let client = crate::infrastructure::valorant_api_http::build_client()?;
    let parsed: VersionResponse = crate::infrastructure::valorant_api_http::get_json(&client, "version").await?;

    let version = version_from_api(&parsed.data);
    *LATEST_VERSION_CACHE.lock().unwrap() = Some((Instant::now(), version.clone()));
    Ok(version)
}

async fn fetch_local_version() -> Option<ValorantVersionDto> {
    let contents = read_shooter_game_log_tail().await?;
    let riot_client_version = parse_local_version_from_log(&contents)?;
    Some(version_from_riot_client_string(&riot_client_version))
}

async fn read_shooter_game_log_tail() -> Option<String> {
    let local_app_data = std::env::var_os("LOCALAPPDATA")?;
    let path = std::path::Path::new(&local_app_data)
        .join("VALORANT")
        .join("Saved")
        .join("Logs")
        .join("ShooterGame.log");
    let metadata = tokio::fs::metadata(&path).await.ok()?;
    let start = metadata.len().saturating_sub(VERSION_LOG_MAX_BYTES);
    let mut file = tokio::fs::File::open(&path).await.ok()?;
    file.seek(SeekFrom::Start(start)).await.ok()?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).await.ok()?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

fn parse_local_version_from_log(contents: &str) -> Option<String> {
    const MARKER: &str = "CI server version: ";
    let idx = contents.rfind(MARKER)?;
    let rest = &contents[idx + MARKER.len()..];
    let version = rest.lines().next()?.trim();
    if version.is_empty() { None } else { Some(version.to_string()) }
}

fn version_from_api(data: &VersionData) -> ValorantVersionDto {
    let build_number = data.build_version.parse().unwrap_or_default();
    let branch_display = data.branch.strip_prefix("release-").unwrap_or(&data.branch).to_string();
    ValorantVersionDto {
        branch       : data.branch.clone(),
        game_version : data.version.clone(),
        build_number,
        riot_client_version: data.riot_client_version.clone(),
        label: format_version_label(Some(branch_display), Some(build_number)),
    }
}

fn version_from_riot_client_string(riot_client_version: &str) -> ValorantVersionDto {
    let branch = parse_branch(riot_client_version).unwrap_or_else(|| "unknown".to_string());
    let build_number = parse_build_number(riot_client_version).unwrap_or_default();
    ValorantVersionDto {
        branch       : branch.clone(),
        game_version : riot_client_version.to_string(),
        build_number,
        riot_client_version: riot_client_version.to_string(),
        label: format_version_label(Some(branch), Some(build_number)),
    }
}

fn format_version_label(branch: Option<String>, build_number: Option<u32>) -> String {
    match (branch, build_number) {
        (Some(branch), Some(build)) => format!("{branch} · b{build}"),
        (Some(branch), None) => branch,
        (None, Some(build)) => format!("b{build}"),
        (None, None) => "Unknown".to_string(),
    }
}

fn parse_branch(riot_client_version: &str) -> Option<String> {
    let rest = riot_client_version.strip_prefix("release-")?;
    let branch = rest.split("-shipping-").next()?;
    if branch.is_empty() { None } else { Some(branch.to_string()) }
}

fn parse_build_number(riot_client_version: &str) -> Option<u32> {
    let rest = riot_client_version.split("shipping-").nth(1)?;
    rest.split('-').next()?.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_local_version_from_log_line() {
        let log = "LogShooter: Display: CI server version: release-13.00-shipping-32-4990475\n";
        assert_eq!(
            parse_local_version_from_log(log).as_deref(),
            Some("release-13.00-shipping-32-4990475")
        );
    }

    #[test]
    fn uses_latest_log_version() {
        let log = "CI server version: release-13.00-shipping-28-4928912\nlater\nCI server version: release-13.00-shipping-32-4990475\n";
        assert_eq!(
            parse_local_version_from_log(log).as_deref(),
            Some("release-13.00-shipping-32-4990475")
        );
    }

    #[test]
    fn parses_build_number_from_client_version() {
        assert_eq!(parse_build_number("release-13.00-shipping-32-4990475"), Some(32));
    }

}