use tauri::State;

use crate::application::{community_board, discord_auth_flow};
use crate::dto::{CommentsPageDto, CommunityConfigDto};
use crate::invoke_error::{InvokeErrorDto, invoke_err, sign_in_required};
use crate::state::AppState;

#[tauri::command]
pub async fn fetch_community_configs() -> Result<Vec<CommunityConfigDto>, InvokeErrorDto> {
    community_board::list_configs().await.map_err(invoke_err)
}

#[tauri::command]
pub async fn fetch_config_comments(
    config_id: String,
    limit    : Option<u32>,
    offset   : Option<u32>,
    parent_id: Option<String>,
) -> Result<CommentsPageDto, InvokeErrorDto> {
    community_board::list_comments(&config_id, limit, offset, parent_id.as_deref())
        .await
        .map_err(invoke_err)
}

#[tauri::command]
pub async fn fetch_config_reaction(state: State<'_, AppState>, config_id: String) -> Result<Option<i8>, InvokeErrorDto> {
    let session = discord_auth_flow::current_session(&state).ok_or_else(sign_in_required)?;
    let token   = discord_auth_flow::access_token(&state).await.map_err(invoke_err)?.ok_or_else(sign_in_required)?;
    community_board::my_reaction(&token, &session.user_id, &config_id).await.map_err(invoke_err)
}

#[tauri::command]
pub async fn set_config_reaction(state: State<'_, AppState>, config_id: String, reaction: i8) -> Result<(), InvokeErrorDto> {
    let session = discord_auth_flow::current_session(&state).ok_or_else(sign_in_required)?;
    let token   = discord_auth_flow::access_token(&state).await.map_err(invoke_err)?.ok_or_else(sign_in_required)?;
    community_board::set_reaction(&token, &session.user_id, &config_id, reaction)
        .await
        .map_err(invoke_err)
}

#[tauri::command]
pub async fn clear_config_reaction(state: State<'_, AppState>, config_id: String) -> Result<(), InvokeErrorDto> {
    let session = discord_auth_flow::current_session(&state).ok_or_else(sign_in_required)?;
    let token   = discord_auth_flow::access_token(&state).await.map_err(invoke_err)?.ok_or_else(sign_in_required)?;
    community_board::clear_reaction(&token, &session.user_id, &config_id).await.map_err(invoke_err)
}

#[tauri::command]
pub async fn post_config_comment(
    state: State<'_, AppState>,
    config_id: String,
    body     : String,
    parent_id: Option<String>,
) -> Result<(), InvokeErrorDto> {
    let token = discord_auth_flow::access_token(&state).await.map_err(invoke_err)?.ok_or_else(sign_in_required)?;
    community_board::post_comment(&token, &config_id, &body, parent_id.as_deref())
        .await
        .map_err(invoke_err)
}

#[tauri::command]
pub async fn update_config_comment(state: State<'_, AppState>, comment_id: String, body: String) -> Result<(), InvokeErrorDto> {
    let token = discord_auth_flow::access_token(&state).await.map_err(invoke_err)?.ok_or_else(sign_in_required)?;
    community_board::update_comment(&token, &comment_id, &body)
        .await
        .map_err(invoke_err)
}

#[tauri::command]
pub async fn delete_config_comment(state: State<'_, AppState>, comment_id: String) -> Result<(), InvokeErrorDto> {
    let token = discord_auth_flow::access_token(&state).await.map_err(invoke_err)?.ok_or_else(sign_in_required)?;
    community_board::delete_comment(&token, &comment_id).await.map_err(invoke_err)
}

#[tauri::command]
pub async fn create_config(
    state: State<'_, AppState>,
    name       : String,
    note       : String,
    r#type     : String,
    perspective: Option<String>,
    data       : serde_json::Value,
) -> Result<(), InvokeErrorDto> {
    let token = discord_auth_flow::access_token(&state).await.map_err(invoke_err)?.ok_or_else(sign_in_required)?;
    community_board::create_config(&token, &name, &note, &r#type, perspective.as_deref(), data).await.map_err(invoke_err)
}

#[tauri::command]
pub async fn update_config(
    state: State<'_, AppState>,
    config_id  : String,
    name       : String,
    note       : String,
    r#type     : String,
    perspective: Option<String>,
    data       : serde_json::Value,
) -> Result<(), InvokeErrorDto> {
    let token = discord_auth_flow::access_token(&state).await.map_err(invoke_err)?.ok_or_else(sign_in_required)?;
    community_board::update_config(&token, &config_id, &name, &note, &r#type, perspective.as_deref(), data)
        .await
        .map_err(invoke_err)
}

#[tauri::command]
pub async fn delete_config(state: State<'_, AppState>, config_id: String) -> Result<(), InvokeErrorDto> {
    let token = discord_auth_flow::access_token(&state).await.map_err(invoke_err)?.ok_or_else(sign_in_required)?;
    community_board::delete_config(&token, &config_id).await.map_err(invoke_err)
}