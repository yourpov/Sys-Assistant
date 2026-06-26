use crate::error::AppError;

const CHANGELOG_URL: &str = "https://raw.githubusercontent.com/yourpov/Sys-Assistant/refs/heads/main/Changelogs";

pub async fn fetch_changelog() -> Result<String, AppError> {
    let response = reqwest::get(CHANGELOG_URL).await.map_err(|e| AppError::Network(format!("couldn't reach the changelog ({e})")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!("couldn't load the changelog (status {})", response.status())));
    }

    response.text().await.map_err(|e| AppError::Network(format!("couldn't read the changelog ({e})")))
}
