use tauri::State;

use crate::application::discord_auth_flow;
use crate::dto::AuthSessionDto;
use crate::invoke_error::{InvokeErrorDto, invoke_err};
use crate::state::AppState;

#[tauri::command]
pub fn start_discord_sign_in(state: State<'_, AppState>) -> Result<String, InvokeErrorDto> {
    Ok(discord_auth_flow::start_sign_in(&state))
}

#[tauri::command]
pub async fn sign_in_as_guest(state: State<'_, AppState>) -> Result<AuthSessionDto, InvokeErrorDto> {
    discord_auth_flow::sign_in_as_guest(&state).await.map(Into::into).map_err(invoke_err)
}

#[tauri::command]
pub fn sign_out(state: State<'_, AppState>) -> Result<(), InvokeErrorDto> {
    discord_auth_flow::sign_out(&state).map_err(invoke_err)
}

#[tauri::command]
pub fn current_auth_session(state: State<'_, AppState>) -> Result<Option<AuthSessionDto>, InvokeErrorDto> {
    Ok(discord_auth_flow::current_session(&state).map(Into::into))
}