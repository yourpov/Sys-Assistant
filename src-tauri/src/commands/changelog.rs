use crate::application::changelog;
use crate::invoke_error::{InvokeErrorDto, invoke_err};

#[tauri::command]
pub async fn fetch_changelog() -> Result<String, InvokeErrorDto> {
    changelog::fetch().await.map_err(invoke_err)
}