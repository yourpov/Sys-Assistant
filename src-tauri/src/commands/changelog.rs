use crate::infrastructure::changelog;

#[tauri::command]
pub async fn fetch_changelog() -> Result<String, String> {
    changelog::fetch_changelog().await.map_err(|e| e.to_string())
}
