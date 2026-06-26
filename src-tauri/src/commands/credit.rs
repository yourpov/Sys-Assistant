use crate::dto::AppCreditDto;
use crate::infrastructure::lanyard;

#[tauri::command]
pub async fn get_app_credit() -> Result<AppCreditDto, String> {
    lanyard::fetch_app_credit().await.map_err(|e| e.to_string())
}
