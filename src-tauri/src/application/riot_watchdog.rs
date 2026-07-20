use std::time::Duration;

use tauri::{AppHandle, Manager};

use super::ports::LogLevel;
use crate::state::AppState;

const POLL_INTERVAL: Duration = Duration::from_secs(3);

pub async fn run(app: AppHandle) {
    let mut was_running = riot_is_running(&app).await;

    loop {
        tokio::time::sleep(POLL_INTERVAL).await;

        let state      = app.state::<AppState>();
        let ports      = state.ports.clone();
        let is_running = ports.riot_runtime.running_path().await.is_some();

        if !is_running && was_running {
            ports.riot_session.invalidate_login_cache();
            ports.sink.emit_line(LogLevel::Warn, "riot client closed");
        }

        was_running = is_running;
    }
}

async fn riot_is_running(app: &AppHandle) -> bool {
    app.state::<AppState>().ports.riot_runtime.running_path().await.is_some()
}
