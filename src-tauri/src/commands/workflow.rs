use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::application::ports::{LogLevel, Ports};
use crate::application::run_workflow::{self, StopToken};
use crate::application::{account_swap, check_issues, manual_actions};
use crate::commands::keybind;
use crate::domain::Settings;
use crate::dto::{CheckOutcomeDto, IssueReportDto, ManualActionDto, SettingsDto, WorkflowActionDto};
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn run_action(state: State<'_, AppState>, action: WorkflowActionDto) -> Result<(), String> {
    let stop = take_stop_token(&state);
    let settings = state.current_settings();
    let result = run_workflow::run(action.into(), &settings, &state.ports, &stop).await;
    clear_stop_token(&state);
    result.inspect_err(|e| log_failure(&state.ports, e)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn run_manual_action(state: State<'_, AppState>, action: ManualActionDto) -> Result<(), String> {
    let stop = take_stop_token(&state);
    let settings = state.current_settings();
    let result = manual_actions::run(action.into(), &settings, &state.ports, &stop).await;
    clear_stop_token(&state);
    result.inspect_err(|e| log_failure(&state.ports, e)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn run_account_swap(state: State<'_, AppState>, account_ids: Vec<String>) -> Result<(), String> {
    let stop = take_stop_token(&state);
    let settings = state.current_settings();
    let last_used = state.account_swap_last_used.lock().unwrap().clone();
    let result = account_swap::run(
        &account_ids,
        last_used.as_deref(),
        state.accounts.as_ref(),
        state.sessions.as_ref(),
        state.riot_login.as_ref(),
        &settings,
        &state.ports,
        &stop,
    )
    .await;
    clear_stop_token(&state);
    match result {
        Ok(account_id) => {
            *state.account_swap_last_used.lock().unwrap() = Some(account_id);
            Ok(())
        }
        Err(e) => {
            log_failure(&state.ports, &e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> SettingsDto {
    SettingsDto::from(&state.current_settings())
}

#[tauri::command]
pub fn find_file_path(state: State<'_, AppState>, filename: String) -> Option<String> {
    state.ports.files.find(&filename, None).map(|p| p.display().to_string())
}

#[tauri::command]
pub fn save_settings(app: AppHandle, state: State<'_, AppState>, settings: SettingsDto) -> Result<(), String> {
    let settings: Settings = settings.into();
    state.save_settings(settings.clone()).map_err(|e| e.to_string())?;
    keybind::sync_insert_shortcut(&app, &state, settings.insert_sim_enabled, settings.insert_sim_keybind.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_action(state: State<'_, AppState>) {
    if let Some(stop) = state.active_stop.lock().unwrap().as_ref() {
        stop.store(true, Ordering::Relaxed);
    }
}

#[tauri::command]
pub async fn check_for_issues(state: State<'_, AppState>) -> Result<CheckOutcomeDto, String> {
    let stop = take_stop_token(&state);
    let settings = state.current_settings();
    let result = check_issues::check(&state.ports, &settings, &stop).await;
    clear_stop_token(&state);
    result.inspect_err(|e| log_failure(&state.ports, e)).map(CheckOutcomeDto::from).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fix_issues(state: State<'_, AppState>, report: IssueReportDto) -> Result<(), String> {
    let stop = take_stop_token(&state);
    let result = check_issues::fix(&report.into(), &state.ports, &stop).await;
    clear_stop_token(&state);
    result.inspect_err(|e| log_failure(&state.ports, e)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restart_computer() -> Result<(), String> {
    std::process::Command::new("shutdown")
        .args(["/r", "/t", "0"])
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("couldn't restart the computer ({e}). restart it yourself from the Start menu"))
}

pub(super) fn take_stop_token(state: &State<'_, AppState>) -> StopToken {
    let stop = Arc::new(AtomicBool::new(false));
    *state.active_stop.lock().unwrap() = Some(stop.clone());
    stop
}

pub(super) fn clear_stop_token(state: &State<'_, AppState>) {
    *state.active_stop.lock().unwrap() = None;
}

pub(super) fn log_failure(ports: &Ports, error: &AppError) {
    if matches!(error, AppError::Cancelled) {
        ports.sink.emit_line(LogLevel::Warn, "cancelled");
    } else {
        ports.sink.emit_line(LogLevel::Error, &error.to_string());
    }
}
