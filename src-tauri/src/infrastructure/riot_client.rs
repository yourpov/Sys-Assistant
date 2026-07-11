use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::Value;
use sysinfo::ProcessesToUpdate;

use crate::application::ports::{RiotLauncher, RiotRuntime, RiotSession};
use crate::error::AppError;

use super::process::PROCESS_TABLE;
use super::riot_api::SessionState;

const KNOWN_INSTALL_PATHS: [&str; 2] =
    ["Riot Games\\Riot Client\\RiotClientServices.exe", "Program Files\\Riot Games\\Riot Client\\RiotClientServices.exe"];

pub struct WindowsRiotClient {
    session_state: SessionState,
}

impl WindowsRiotClient {
    pub fn new() -> Self {
        Self { session_state: SessionState::new() }
    }
}

impl Default for WindowsRiotClient {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl RiotRuntime for WindowsRiotClient {
    async fn running_path(&self) -> Option<PathBuf> {
        tokio::task::block_in_place(|| find_riot_client_process(|process| process.exe().map(PathBuf::from)))
    }

    async fn running_pid(&self) -> Option<u32> {
        tokio::task::block_in_place(|| find_riot_client_process(|process| Some(process.pid().as_u32())))
    }

    async fn install_path(&self) -> Option<PathBuf> {
        if let Some(path) = installs_json_path() {
            if path.exists() {
                return Some(path);
            }
        }
        scan_drives_for_riot_client()
    }

    async fn launch_client(&self, path: &Path) -> Result<(), AppError> {
        Command::new(path).spawn().map(|_| ()).map_err(|e| AppError::Launch(path.display().to_string(), e.to_string()))
    }
}

#[async_trait::async_trait]
impl RiotLauncher for WindowsRiotClient {
    async fn launch_valorant_direct(&self, riot_path: &Path) -> Result<(), AppError> {
        Command::new(riot_path)
            .args(["--launch-product=valorant", "--launch-patchline=live"])
            .spawn()
            .map(|_| ())
            .map_err(|e| AppError::Launch(riot_path.display().to_string(), e.to_string()))
    }

    async fn launch_valorant_via_api(&self) -> Result<(), AppError> {
        super::riot_api::launch_valorant().await
    }
}

#[async_trait::async_trait]
impl RiotSession for WindowsRiotClient {
    async fn is_logged_in(&self) -> bool {
        self.session_state.is_logged_in().await
    }

    fn invalidate_login_cache(&self) {
        self.session_state.invalidate();
    }

    async fn stay_signed_in_enabled(&self) -> bool {
        let Some(path) = riot_client_settings_path() else { return false };
        let Ok(contents) = tokio::fs::read_to_string(&path).await else { return false };
        contents
            .lines()
            .any(|line| line.trim().strip_prefix("stay-signed-in-modal-shown:").is_some_and(|rest| rest.trim().eq_ignore_ascii_case("true")))
    }

    async fn enable_stay_signed_in(&self) -> Result<(), AppError> {
        let path = riot_client_settings_path()
            .ok_or_else(|| AppError::RiotClient("couldn't find your windows user folder (LOCALAPPDATA isn't set)".into()))?;
        let contents = tokio::fs::read_to_string(&path).await.map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => AppError::RiotClient(
                "riot client's settings file doesn't exist yet. sign into the riot client manually once, then try again".into(),
            ),
            _ => AppError::RiotClient(format!("couldn't read the riot client's settings file ({e})").into()),
        })?;

        let mut found = false;
        let updated: Vec<String> = contents
            .lines()
            .map(|line| {
                let trimmed = line.trim_start();
                if trimmed.starts_with("stay-signed-in-modal-shown:") {
                    found = true;
                    let indent = &line[..line.len() - trimmed.len()];
                    format!("{indent}stay-signed-in-modal-shown: true")
                } else {
                    line.to_string()
                }
            })
            .collect();

        if !found {
            return Err(AppError::RiotClient(
                "couldn't find the \"stay signed in\" setting in the riot client's config. sign in manually once, then try again".into(),
            ));
        }

        tokio::fs::write(&path, updated.join("\n"))
            .await
            .map_err(|e| AppError::RiotClient(format!("couldn't update the riot client's settings file ({e})").into()))
    }
}

fn find_riot_client_process<T>(extract: impl FnOnce(&sysinfo::Process) -> Option<T>) -> Option<T> {
    let mut system = PROCESS_TABLE.lock().unwrap();
    system.refresh_processes(ProcessesToUpdate::All, true);
    system.processes().values().find(|process| process.name().to_string_lossy().to_lowercase().contains("riotclientservices")).and_then(extract)
}

fn riot_client_settings_path() -> Option<PathBuf> {
    let local_app_data = std::env::var_os("LOCALAPPDATA")?;
    Some(Path::new(&local_app_data).join("Riot Games").join("Riot Client").join("Config").join("RiotClientSettings.yaml"))
}

fn installs_json_path() -> Option<PathBuf> {
    let program_data = std::env::var_os("ProgramData")?;
    let path = Path::new(&program_data).join("Riot Games").join("RiotClientInstalls.json");
    let raw = std::fs::read_to_string(&path).ok()?;
    let json: Value = serde_json::from_str(&raw).ok()?;
    json.get("rc_default")?.as_str().map(PathBuf::from)
}

fn scan_drives_for_riot_client() -> Option<PathBuf> {
    for letter in b'C'..=b'Z' {
        let drive_root = format!("{}:\\", letter as char);
        for relative in KNOWN_INSTALL_PATHS {
            let candidate = Path::new(&drive_root).join(relative);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;
    use sysinfo::System;

    const ITERATIONS: u32 = 200;

    #[test]
    #[ignore]
    fn process_table_rescan_cost_fresh_vs_reused() {
        let fresh_start = Instant::now();
        for _ in 0..ITERATIONS {
            let mut system = System::new();
            system.refresh_processes(ProcessesToUpdate::All, true);
            std::hint::black_box(system.processes().len());
        }
        let fresh_elapsed = fresh_start.elapsed();

        find_riot_client_process(|_| Some(()));

        let reused_start = Instant::now();
        for _ in 0..ITERATIONS {
            std::hint::black_box(find_riot_client_process(|_| Some(())));
        }
        let reused_elapsed = reused_start.elapsed();

        println!(
            "fresh System::new()+refresh: {:>8.3}ms/call ({ITERATIONS} calls, {:.1}ms total)",
            fresh_elapsed.as_secs_f64() * 1000.0 / ITERATIONS as f64,
            fresh_elapsed.as_secs_f64() * 1000.0,
        );
        println!(
            "reused System+refresh:       {:>8.3}ms/call ({ITERATIONS} calls, {:.1}ms total)",
            reused_elapsed.as_secs_f64() * 1000.0 / ITERATIONS as f64,
            reused_elapsed.as_secs_f64() * 1000.0,
        );
        assert!(reused_elapsed <= fresh_elapsed, "reusing the System instance should not be slower than rebuilding it every call");
    }
}