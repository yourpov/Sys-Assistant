use std::time::Duration;

use tauri::{AppHandle, Manager};

use super::ports::LogLevel;
use super::run_workflow::{SESH_EXE, VALORANT_PROCESS};
use crate::state::AppState;

const POLL_INTERVAL: Duration = Duration::from_secs(5);

pub async fn run(app: AppHandle) {
    let mut missing_file_warned = false;

    loop {
        tokio::time::sleep(POLL_INTERVAL).await;

        let state    = app.state::<AppState>();
        let settings = state.current_settings();
        if !settings.sesh_watchdog_enabled {
            missing_file_warned = false;
            continue;
        }

        if crate::infrastructure::sync_lock::lock_or_recover(&state.active_stop).is_some() {
            continue;
        }

        let ports = state.ports.clone();
        if !ports.processes.is_running(VALORANT_PROCESS).await || ports.processes.is_running(SESH_EXE).await {
            missing_file_warned = false;
            continue;
        }

        let Some(path) = ports.files.find(SESH_EXE, settings.sesh_path.as_deref()) else {
            if !missing_file_warned {
                ports.sink.emit_line(
                    LogLevel::Warn,
                    &format!("sesh watchdog: {SESH_EXE} couldn't be found to recover. set its path in settings"),
                );
                missing_file_warned = true;
            }
            continue;
        };
        missing_file_warned = false;

        ports.sink.emit_line(LogLevel::Warn, "session closed unexpectedly, recovering it");
        match ports.launcher.launch(&path, &[]).await {
            Ok(()) => ports.sink.emit_line(LogLevel::Ok, "sesh reopened"),
            Err(e) => ports.sink.emit_line(LogLevel::Error, &format!("couldn't recover sesh ({e})")),
        }
    }
}