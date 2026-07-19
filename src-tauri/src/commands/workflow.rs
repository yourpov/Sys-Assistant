use std::sync::atomic::Ordering;

use tauri::{AppHandle, State};

pub(crate) struct WorkflowStopGuard<'a> {
    state: &'a State<'a, AppState>,
    pub(crate) token: StopToken,
}

impl Drop for WorkflowStopGuard<'_> {
    fn drop(&mut self) {
        self.state.release_stop_token_if_current(&self.token);
    }
}

use crate::application::ports::{LogLevel, Ports};
use crate::application::run_workflow::{self, StopToken};
use crate::application::riot_watchdog::AccountRiotFlowGuard;
use crate::application::{account_swap, check_issues, manual_actions};
use crate::commands::keybind;
use crate::domain::Settings;
use crate::dto::{CheckOutcomeDto, IssueReportDto, ManualActionDto, SettingsDto, WorkflowActionDto};
use crate::error::AppError;
use crate::infrastructure::sync_lock::lock_or_recover;
use crate::invoke_error::{InvokeErrorDto, invoke_err, invoke_err_msg};
use crate::state::AppState;

#[tauri::command]
pub async fn run_action(state: State<'_, AppState>, action: WorkflowActionDto) -> Result<(), InvokeErrorDto> {
    let guard    = try_take_stop_token(&state)?;
    let settings = state.current_settings();
    run_workflow::run(action.into(), &settings, &state.ports, &guard.token)
        .await
        .inspect_err(|e| log_failure(&state.ports, e))
        .map_err(invoke_err)
}

#[tauri::command]
pub async fn run_manual_action(state: State<'_, AppState>, action: ManualActionDto) -> Result<(), InvokeErrorDto> {
    let guard    = try_take_stop_token(&state)?;
    let settings = state.current_settings();
    let action   = action.into_action().ok_or_else(|| {
        invoke_err_msg(
            "invalid_manual_action",
            "That manual action isn't available anymore",
            "Refresh the app or pick a different action from Manual steps.",
            "manual action removed",
        )
    })?;
    manual_actions::run(action, &settings, &state.ports, &guard.token)
        .await
        .inspect_err(|e| log_failure(&state.ports, e))
        .map_err(invoke_err)
}

#[tauri::command]
pub async fn run_account_swap(state: State<'_, AppState>, account_ids: Vec<String>) -> Result<(), InvokeErrorDto> {
    let _flow_guard = AccountRiotFlowGuard::new(&state);
    let guard       = try_take_stop_token(&state)?;
    let settings    = state.current_settings();
    let last_used = lock_or_recover(&state.account_swap_last_used).clone();
    let result = account_swap::run(
        &account_ids,
        last_used.as_deref(),
        state.accounts.as_ref(),
        state.sessions.as_ref(),
        state.riot_login.as_ref(),
        &settings,
        &state.ports,
        &guard.token,
    )
    .await;
    match result {
        Ok(account_id) => {
            *lock_or_recover(&state.account_swap_last_used) = Some(account_id);
            Ok(())
        }
        Err(e) => {
            log_failure(&state.ports, &e);
            Err(invoke_err(e))
        }
    }
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<SettingsDto, InvokeErrorDto> {
    Ok(SettingsDto::from(&state.current_settings()))
}

#[tauri::command]
pub fn find_file_path(state: State<'_, AppState>, filename: String) -> Result<Option<String>, InvokeErrorDto> {
    Ok(state.ports.files.find(&filename, None).map(|p| p.display().to_string()))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, state: State<'_, AppState>, settings: SettingsDto) -> Result<(), InvokeErrorDto> {
    let settings: Settings = settings.into();
    state.save_settings(settings.clone()).map_err(invoke_err)?;
    keybind::sync_insert_shortcut(&app, &state, settings.insert_sim_enabled, settings.insert_sim_keybind.as_deref()).map_err(|e| {
        invoke_err_msg(
            "keybind_failed",
            "Your keybind couldn't be saved",
            "Pick a different key or turn the keybind off, then try again.",
            e.to_string(),
        )
    })
}

#[tauri::command]
pub fn cancel_action(state: State<'_, AppState>) -> Result<(), InvokeErrorDto> {
    let guard = lock_or_recover(&state.active_stop);
    match guard.as_ref() {
        Some(stop) if !stop.load(Ordering::Acquire) => {
            stop.store(true, Ordering::Release);
            log_failure(&state.ports, &AppError::Cancelled);
        }
        Some(_) => {}
        None => log_failure(&state.ports, &AppError::Cancelled),
    }
    Ok(())
}

#[tauri::command]
pub async fn check_for_issues(state: State<'_, AppState>) -> Result<CheckOutcomeDto, InvokeErrorDto> {
    let guard    = try_take_stop_token(&state)?;
    let settings = state.current_settings();
    check_issues::check(&state.ports, &settings, &guard.token).await
        .inspect_err(|e| {
            if !matches!(e, AppError::Cancelled) {
                log_failure(&state.ports, e);
            }
        })
        .map(CheckOutcomeDto::from)
        .map_err(invoke_err)
}

#[tauri::command]
pub async fn fix_issues(state: State<'_, AppState>, report: IssueReportDto) -> Result<(), InvokeErrorDto> {
    let guard = try_take_stop_token(&state)?;
    check_issues::fix(&report.into(), &state.ports, &guard.token).await
        .inspect_err(|e| {
            if !matches!(e, AppError::Cancelled) {
                log_failure(&state.ports, e);
            }
        })
        .map_err(invoke_err)
}

#[tauri::command]
pub fn release_workflow_stop(state: State<'_, AppState>) -> Result<(), InvokeErrorDto> {
    clear_stop_token(&state);
    Ok(())
}

#[tauri::command]
pub async fn restart_computer() -> Result<(), InvokeErrorDto> {
    std::process::Command::new("shutdown")
        .args(["/r", "/t", "0"])
        .spawn()
        .map(|_| ())
        .map_err(|e| {
            invoke_err_msg(
                "restart_failed",
                "Your PC couldn't restart",
                "Restart manually from the Start menu.",
                format!("couldn't restart the computer ({e})"),
            )
        })
}

pub fn try_take_stop_token<'a>(state: &'a State<'a, AppState>) -> Result<WorkflowStopGuard<'a>, InvokeErrorDto> {
    match state.try_claim_stop_token() {
        Some(token) => Ok(WorkflowStopGuard { state, token }),
        None => Err(invoke_err_msg(
            "workflow_already_running",
            "Another action is already running",
            "Wait for it to finish or cancel it, then try again.",
            "active_stop already occupied",
        )),
    }
}

pub fn clear_stop_token(state: &State<'_, AppState>) {
    *lock_or_recover(&state.active_stop) = None;
}

pub(super) fn log_failure(ports: &Ports, error: &AppError) {
    if matches!(error, AppError::Cancelled) {
        ports.sink.emit_line(LogLevel::Warn, "cancelled");
    } else {
        ports.sink.emit_line(LogLevel::Error, &error.to_string());
    }
}