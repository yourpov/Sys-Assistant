use crate::application::feedback;
use crate::invoke_error::{InvokeErrorDto, invoke_err};

#[tauri::command]
pub async fn submit_feedback(kind: String, title: String, description: String) -> Result<(), InvokeErrorDto> {
    feedback::submit(kind, title, description).await.map_err(invoke_err)
}