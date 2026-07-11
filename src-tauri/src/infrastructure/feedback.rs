use serde::Serialize;

use crate::error::AppError;

const SUGGEST_FEATURE_URL: &str  = "https://ykzpldiiygssqtcmvlvn.supabase.co/functions/v1/suggest-feature";
const MAX_TITLE_LEN: usize       = 100;
const MAX_DESCRIPTION_LEN: usize = 1000;

#[derive(Serialize)]
struct FeedbackPayload<'a> {
    kind        : &'a str,
    title       : &'a str,
    description : &'a str,
}

pub async fn submit_feedback(kind: String, title: String, description: String) -> Result<(), AppError> {
    let kind = if kind == "bug" { "bug" } else { "feature" };
    let title = title.trim();
    let description = description.trim();

    if title.is_empty() || title.chars().count() > MAX_TITLE_LEN {
        return Err(AppError::Input(format!("title must be 1-{MAX_TITLE_LEN} characters")));
    }
    if description.is_empty() || description.chars().count() > MAX_DESCRIPTION_LEN {
        return Err(AppError::Input(format!("description must be 1-{MAX_DESCRIPTION_LEN} characters")));
    }

    let client = reqwest::Client::new();
    let response = client
        .post(SUGGEST_FEATURE_URL)
        .json(&FeedbackPayload { kind, title, description })
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't reach the feedback service ({e})")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!("the feedback service rejected this (status {})", response.status())));
    }

    Ok(())
}
