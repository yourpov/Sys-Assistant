use crate::dto::{CommentsPageDto, CommunityConfigDto};
use crate::error::AppError;
use crate::infrastructure::community_configs;

pub async fn list_configs() -> Result<Vec<CommunityConfigDto>, AppError> {
    community_configs::fetch_configs().await
}

pub async fn list_comments(
    config_id: &str,
    limit    : Option<u32>,
    offset   : Option<u32>,
    parent_id: Option<&str>,
) -> Result<CommentsPageDto, AppError> {
    community_configs::fetch_comments_page(config_id, limit, offset, parent_id).await
}

pub async fn my_reaction(token: &str, user_id: &str, config_id: &str) -> Result<Option<i8>, AppError> {
    community_configs::fetch_my_reaction(token, user_id, config_id).await
}

pub async fn set_reaction(token: &str, user_id: &str, config_id: &str, reaction: i8) -> Result<(), AppError> {
    community_configs::set_reaction(token, user_id, config_id, reaction).await
}

pub async fn clear_reaction(token: &str, user_id: &str, config_id: &str) -> Result<(), AppError> {
    community_configs::clear_reaction(token, user_id, config_id).await
}

pub async fn post_comment(token: &str, config_id: &str, body: &str, parent_id: Option<&str>) -> Result<(), AppError> {
    community_configs::post_comment(token, config_id, body, parent_id).await
}

pub async fn update_comment(token: &str, comment_id: &str, body: &str) -> Result<(), AppError> {
    community_configs::update_comment(token, comment_id, body).await
}

pub async fn delete_comment(token: &str, comment_id: &str) -> Result<(), AppError> {
    community_configs::delete_comment(token, comment_id).await
}

pub async fn create_config(
    token      : &str,
    name       : &str,
    note       : &str,
    config_type: &str,
    perspective: Option<&str>,
    data       : serde_json::Value,
) -> Result<(), AppError> {
    community_configs::create_config(token, name, note, config_type, perspective, data).await
}

pub async fn update_config(
    token      : &str,
    config_id  : &str,
    name       : &str,
    note       : &str,
    config_type: &str,
    perspective: Option<&str>,
    data       : serde_json::Value,
) -> Result<(), AppError> {
    community_configs::update_config(token, config_id, name, note, config_type, perspective, data).await
}

pub async fn delete_config(token: &str, config_id: &str) -> Result<(), AppError> {
    community_configs::delete_config(token, config_id).await
}