use tauri::{AppHandle, Manager, State};

use super::workflow::try_take_stop_token;
use crate::application::collection_fetch;
use crate::application::manual_actions;
use crate::domain::ManualAction;
use crate::dto::{CollectionSnapshotDto, RiotClientStatusDto};
use crate::invoke_error::{InvokeErrorDto, invoke_err, invoke_err_msg};
use crate::state::AppState;

fn log_collection_failure(app: &AppHandle, message: impl AsRef<str>) {
    if let Some(state) = app.try_state::<AppState>() {
        state.app_log.append("error", &format!("[collection] {}", message.as_ref()));
    }
}

fn log_collection_warning(app: &AppHandle, message: impl AsRef<str>) {
    if let Some(state) = app.try_state::<AppState>() {
        state.app_log.append("warn", &format!("[collection] {}", message.as_ref()));
    }
}

#[tauri::command]
pub async fn get_riot_client_status(state: State<'_, AppState>) -> Result<RiotClientStatusDto, InvokeErrorDto> {
    let running = state.ports.riot_runtime.running_path().await.is_some();
    let logged_in = if running { state.ports.riot_session.is_logged_in().await } else { false };
    Ok(RiotClientStatusDto { running, logged_in })
}

#[tauri::command]
pub async fn open_riot_client(state: State<'_, AppState>) -> Result<(), InvokeErrorDto> {
    if state.ports.riot_runtime.running_path().await.is_some() {
        return Ok(());
    }
    let guard    = try_take_stop_token(&state)?;
    let settings = state.current_settings();
    manual_actions::run(ManualAction::ToggleRiotClient, &settings, &state.ports, &guard.token)
        .await
        .map_err(invoke_err)
}

#[tauri::command]
pub async fn fetch_collection(app: AppHandle, state: State<'_, AppState>) -> Result<CollectionSnapshotDto, InvokeErrorDto> {
    let config_dir = app.path().app_config_dir().map_err(|e| {
        let log = format!("couldn't resolve app config folder ({e})");
        log_collection_failure(&app, &log);
        invoke_err_msg(
            "config_dir_failed",
            "Your collection couldn't load",
            "The app couldn't find its config folder. Restart the app and try again.",
            log,
        )
    })?;
    let snapshot = collection_fetch::fetch(&config_dir, Some(&state.app_log)).await.map_err(|e| {
        log_collection_failure(&app, e.to_string());
        invoke_err(e)
    })?;
    if !snapshot.catalog_loaded {
        if let Some(warning) = &snapshot.catalog_warning {
            log_collection_warning(&app, warning);
        }
    }
    if let Some(warning) = &snapshot.session_warning {
        log_collection_warning(&app, warning);
    }
    Ok(snapshot)
}