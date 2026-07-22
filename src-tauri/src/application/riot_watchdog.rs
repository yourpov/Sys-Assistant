use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use super::ports::LogLevel;
use super::run_workflow::{self, VALORANT_PROCESS};
use crate::state::AppState;

const POLL_INTERVAL: Duration = Duration::from_secs(3);

pub async fn run(app: AppHandle) {
    let mut riot_was_running = riot_is_running(&app).await;
    let mut val_was_running  = valorant_is_running(&app).await;

    loop {
        tokio::time::sleep(POLL_INTERVAL).await;

        let state        = app.state::<AppState>();
        let ports        = state.ports.clone();
        let riot_running = ports.riot_runtime.running_path().await.is_some();
        let val_running  = ports.processes.is_running(VALORANT_PROCESS).await;

        if !riot_running && riot_was_running {
            ports.riot_session.invalidate_login_cache();
            ports.sink.emit_line(LogLevel::Warn, "riot client closed");
        }

        if val_running && !val_was_running {
            let settings = state.current_settings();
            if settings.auto_run_loader_on_valorant {
                let stop = Arc::new(AtomicBool::new(false));
                if let Err(e) = run_workflow::run_loader_if_idle(&ports, &settings, &stop).await {
                    ports.sink.emit_line(LogLevel::Warn, &format!("couldn't auto-run the loader: {e}"));
                }
            }
        }

        riot_was_running = riot_running;
        val_was_running  = val_running;
    }
}

async fn riot_is_running(app: &AppHandle) -> bool {
    app.state::<AppState>().ports.riot_runtime.running_path().await.is_some()
}

async fn valorant_is_running(app: &AppHandle) -> bool {
    app.state::<AppState>().ports.processes.is_running(VALORANT_PROCESS).await
}
