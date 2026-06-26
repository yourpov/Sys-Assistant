use crate::error::AppError;

const CHANGELOG_URL: &str = "https://gist.githubusercontent.com/yourpov/1052a48e171d32c01c2b0f3c14235e42/raw/Changelogs";

pub async fn fetch_changelog() -> Result<String, AppError> {
    let response = reqwest::get(CHANGELOG_URL).await.map_err(|e| AppError::Network(format!("couldn't reach the changelog ({e})")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!("couldn't load the changelog (status {})", response.status())));
    }

    response.text().await.map_err(|e| AppError::Network(format!("couldn't read the changelog ({e})")))
}
