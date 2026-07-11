use crate::error::AppError;
use crate::infrastructure::changelog;

pub async fn fetch() -> Result<String, AppError> {
    changelog::fetch_changelog().await
}