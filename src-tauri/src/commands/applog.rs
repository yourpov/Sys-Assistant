use tauri::State;

use crate::invoke_error::InvokeErrorDto;
use crate::state::AppState;

#[tauri::command]
pub fn read_app_log(state: State<'_, AppState>) -> Result<String, InvokeErrorDto> {
    Ok(state.app_log.read())
}

#[tauri::command]
pub fn clear_app_log(state: State<'_, AppState>) -> Result<(), InvokeErrorDto> {
    state.app_log.clear();
    Ok(())
}

#[tauri::command]
pub fn append_app_log(state: State<'_, AppState>, level: String, message: String) -> Result<(), InvokeErrorDto> {
    let level = match level.as_str() {
        "ok" | "warn" | "error" | "info" => level.as_str(),
        _ => "info",
    };
    state.app_log.append(level, &message);
    Ok(())
}