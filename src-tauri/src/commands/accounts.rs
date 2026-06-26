use tauri::State;

use super::workflow::{clear_stop_token, log_failure, take_stop_token};
use crate::application::account_login;
use crate::dto::AccountDto;
use crate::state::AppState;

#[tauri::command]
pub fn list_accounts(state: State<'_, AppState>) -> Vec<AccountDto> {
    state
        .accounts
        .list()
        .into_iter()
        .map(|account| {
            let has_session = state.sessions.has_snapshot(&account.id);
            AccountDto { has_session, ..AccountDto::from(account) }
        })
        .collect()
}

#[tauri::command]
pub fn add_account(state: State<'_, AppState>, label: String, username: String, password: String) -> Result<AccountDto, String> {
    state.accounts.add(label, username, password).map(AccountDto::from).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_account(state: State<'_, AppState>, id: String, label: String, username: String, password: Option<String>) -> Result<(), String> {
    state.accounts.update(&id, label, username, password).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_account(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.accounts.remove(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn login_account(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let stop = take_stop_token(&state);
    let result =
        account_login::login(&id, state.accounts.as_ref(), state.sessions.as_ref(), state.riot_login.as_ref(), &state.ports, &stop).await;
    clear_stop_token(&state);
    result.inspect_err(|e| log_failure(&state.ports, e)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn forget_account_session(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.sessions.forget(&id).map_err(|e| e.to_string())
}
