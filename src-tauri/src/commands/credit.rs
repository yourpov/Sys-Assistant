use crate::application::credit;
use crate::dto::AppCreditDto;
use crate::invoke_error::{InvokeErrorDto, invoke_err};

#[tauri::command]
pub async fn get_app_credit() -> Result<AppCreditDto, InvokeErrorDto> {
    credit::fetch_app_credit().await.map_err(invoke_err)
}