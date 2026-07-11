use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use super::ports::LogLevel;
use super::run_workflow::{self, SESH_EXE, VALORANT_PROCESS};
use crate::domain::WorkflowAction;
use crate::error::AppError;
use crate::state::AppState;

const POLL_INTERVAL: Duration = Duration::from_secs(5);

pub async fn run(app: AppHandle) {
    let mut was_sesh_running = false;
    let mut armed            = true;
    let mut pending_recovery = false;
    let needs_rearm          = Arc::new(AtomicBool::new(false));

    loop {
        tokio::time::sleep(POLL_INTERVAL).await;

        let state    = app.state::<AppState>();
        let settings = state.current_settings();
        if !settings.anti_temp_ban_enabled {
            was_sesh_running = state.ports.processes.is_running(SESH_EXE).await;
            armed            = true;
            pending_recovery = false;
            continue;
        }

        if needs_rearm.swap(false, Ordering::Relaxed) {
            armed = true;
        }

        let ports            = state.ports.clone();
        let sesh_running     = ports.processes.is_running(SESH_EXE).await;
        let valorant_running = ports.processes.is_running(VALORANT_PROCESS).await;
        let manual_run_active = crate::infrastructure::sync_lock::lock_or_recover(&state.active_stop).is_some();
        let crash_mid_game   = was_sesh_running && valorant_running && !sesh_running;

        if manual_run_active {
            if crash_mid_game {
                pending_recovery = true;
            }
            was_sesh_running = sesh_running;
            continue;
        }

        if sesh_running {
            armed = true;
        }

        if pending_recovery || (armed && crash_mid_game) {
            pending_recovery = false;
            armed            = false;
            ports.sink.emit_line(
                LogLevel::Warn,
                "session closed mid-game, re-running hamad method (anti-temp ban)",
            );
            let app         = app.clone();
            let needs_rearm = needs_rearm.clone();
            tokio::spawn(async move {
                run_hamad_method(&app, &needs_rearm).await;
            });
        }

        was_sesh_running = sesh_running;
    }
}

async fn run_hamad_method(app: &AppHandle, needs_rearm: &AtomicBool) {
    let state = app.state::<AppState>();
    let Some(stop) = state.try_claim_stop_token() else {
        needs_rearm.store(true, Ordering::Relaxed);
        return;
    };

    let settings = state.current_settings();
    let ports    = state.ports.clone();
    let result   = run_workflow::run(WorkflowAction::Start, &settings, &ports, &stop).await;

    state.release_stop_token_if_current(&stop);

    match result {
        Ok(()) => ports.sink.emit_line(LogLevel::Ok, "anti-temp ban: hamad method finished"),
        Err(AppError::Cancelled) => ports.sink.emit_line(LogLevel::Warn, "anti-temp ban: hamad method cancelled"),
        Err(e) => {
            ports.sink.emit_line(LogLevel::Error, &format!("anti-temp ban: hamad method failed ({e})"));
            needs_rearm.store(true, Ordering::Relaxed);
        }
    }
}