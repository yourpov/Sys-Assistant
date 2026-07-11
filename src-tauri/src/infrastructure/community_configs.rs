use std::collections::HashMap;

use serde::Deserialize;

use super::discord_auth::{SUPABASE_ANON_KEY, SUPABASE_URL};
use crate::dto::{CommentsPageDto, CommunityCommentDto, CommunityConfigDto};
use crate::error::AppError;

const MAX_COMMENT_LEN: usize        = 500;
const MAX_NAME_LEN: usize           = 60;
const MAX_DESCRIPTION_LEN: usize    = 500;
const VALID_TYPES: [&str; 4]        = ["legit", "semi_legit", "semi_rage", "rage"];
const VALID_PERSPECTIVES: [&str; 2] = ["first_person", "third_person"];

const COMMENTS_DEFAULT_PAGE_SIZE: u32 = 40;
const COMMENTS_MAX_PAGE_SIZE: u32     = 100;

#[derive(Deserialize)]
struct RawConfigRow {
    id                 : String,
    name               : String,
    note               : Option<String>,
    data               : serde_json::Value,
    #[serde(rename = "type")]
    config_type        : Option<String>,
    perspective        : Option<String>,
    user_id            : Option<String>,
    discord_username   : Option<String>,
    discord_avatar_url : Option<String>,
    created_at         : String,
}

#[derive(Deserialize)]
struct RawCommentRow {
    id                 : String,
    user_id            : Option<String>,
    parent_id          : Option<String>,
    discord_username   : Option<String>,
    discord_avatar_url : Option<String>,
    body               : String,
    created_at         : String,
    updated_at         : String,
}

#[derive(Deserialize)]
struct RawReplyParentRow {
    parent_id: String,
}

#[derive(Deserialize)]
struct RawVoteTotals {
    config_id : String,
    upvotes   : i64,
    downvotes : i64,
}

#[derive(Deserialize)]
struct RawCommentCount {
    config_id     : String,
    comment_count : i64,
}

#[derive(Deserialize)]
struct RawVoteRow {
    vote: i8,
}

fn require_valid_id(config_id: &str) -> Result<(), AppError> {
    uuid::Uuid::parse_str(config_id).map(|_| ()).map_err(|_| AppError::Input("that config id doesn't look right".into()))
}

pub async fn fetch_configs() -> Result<Vec<CommunityConfigDto>, AppError> {
    let client = reqwest::Client::new();
    let configs_request = client
        .get(format!(
            "{SUPABASE_URL}/rest/v1/configs?select=id,name,note,data,type,perspective,user_id,discord_username,discord_avatar_url,created_at&order=created_at.desc"
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .send();
    let totals_request = client.get(format!("{SUPABASE_URL}/rest/v1/config_vote_totals?select=*")).header("apikey", SUPABASE_ANON_KEY).send();
    let comment_counts_request =
        client.get(format!("{SUPABASE_URL}/rest/v1/config_comment_counts?select=*")).header("apikey", SUPABASE_ANON_KEY).send();

    let (configs_response, totals_response, comment_counts_response) = tokio::join!(configs_request, totals_request, comment_counts_request);
    let configs_response = configs_response.map_err(|e| AppError::Network(format!("couldn't reach the community configs board ({e})")))?;
    if !configs_response.status().is_success() {
        return Err(AppError::Network(format!("the community configs board rejected this (status {})", configs_response.status())));
    }
    let rows: Vec<RawConfigRow> =
        configs_response.json().await.map_err(|e| AppError::Network(format!("couldn't read the community configs ({e})")))?;

    let totals_by_config: HashMap<String, (i64, i64)> = match totals_response {
        Ok(response) if response.status().is_success() => {
            response.json::<Vec<RawVoteTotals>>().await.unwrap_or_default().into_iter().map(|t| (t.config_id, (t.upvotes, t.downvotes))).collect()
        }
        _ => HashMap::new(),
    };
    let comment_counts_by_config: HashMap<String, i64> = match comment_counts_response {
        Ok(response) if response.status().is_success() => {
            response.json::<Vec<RawCommentCount>>().await.unwrap_or_default().into_iter().map(|c| (c.config_id, c.comment_count)).collect()
        }
        _ => HashMap::new(),
    };

    Ok(rows
        .into_iter()
        .map(|row| {
            let (likes, dislikes) = totals_by_config.get(&row.id).copied().unwrap_or((0, 0));
            let comment_count = comment_counts_by_config.get(&row.id).copied().unwrap_or(0);
            CommunityConfigDto {
                id                 : row.id,
                name               : row.name,
                note               : row.note,
                data               : row.data,
                config_type        : row.config_type,
                perspective        : row.perspective,
                user_id            : row.user_id,
                discord_username   : row.discord_username,
                discord_avatar_url : row.discord_avatar_url,
                likes,
                dislikes,
                comment_count,
                created_at: row.created_at,
            }
        })
        .collect())
}

fn parse_total_count(headers: &reqwest::header::HeaderMap) -> Option<i64> {
    let value = headers.get("content-range")?.to_str().ok()?;
    let total = value.split('/').nth(1)?;
    total.parse().ok()
}

fn map_comment_row(row: RawCommentRow, reply_count: i64) -> CommunityCommentDto {
    CommunityCommentDto {
        id                 : row.id,
        user_id            : row.user_id,
        parent_id          : row.parent_id,
        discord_username   : row.discord_username,
        discord_avatar_url : row.discord_avatar_url,
        body               : row.body,
        reply_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

async fn attach_reply_counts(comments: &mut [CommunityCommentDto]) -> Result<(), AppError> {
    if comments.is_empty() {
        return Ok(());
    }

    let ids: Vec<String> = comments.iter().map(|comment| comment.id.clone()).collect();
    let filter = ids.join(",");
    let response = reqwest::Client::new()
        .get(format!(
            "{SUPABASE_URL}/rest/v1/config_comments?parent_id=in.({filter})&select=parent_id"
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't load reply counts ({e})")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!("couldn't load reply counts (status {})", response.status())));
    }

    let rows: Vec<RawReplyParentRow> =
        response.json().await.map_err(|e| AppError::Network(format!("couldn't read reply counts ({e})")))?;
    let mut counts: HashMap<String, i64> = HashMap::new();
    for row in rows {
        *counts.entry(row.parent_id).or_insert(0) += 1;
    }

    for comment in comments.iter_mut() {
        comment.reply_count = counts.get(&comment.id).copied().unwrap_or(0);
    }

    Ok(())
}

pub async fn fetch_comments_page(
    config_id: &str,
    limit: Option<u32>,
    offset: Option<u32>,
    parent_id: Option<&str>,
) -> Result<CommentsPageDto, AppError> {
    require_valid_id(config_id)?;
    if let Some(parent) = parent_id {
        require_valid_id(parent)?;
    }

    let limit = limit.unwrap_or(COMMENTS_DEFAULT_PAGE_SIZE).clamp(1, COMMENTS_MAX_PAGE_SIZE);
    let offset = offset.unwrap_or(0);
    let fetch_limit = limit.saturating_add(1);
    let parent_filter = match parent_id {
        Some(parent) => format!("&parent_id=eq.{parent}"),
        None => "&parent_id=is.null".to_string(),
    };

    let response = reqwest::Client::new()
        .get(format!(
            "{SUPABASE_URL}/rest/v1/config_comments?config_id=eq.{config_id}{parent_filter}&select=id,user_id,parent_id,discord_username,discord_avatar_url,body,created_at,updated_at&order=created_at.asc,id.asc&limit={fetch_limit}&offset={offset}"
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Prefer", "count=exact")
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't load comments ({e})")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!("couldn't load comments (status {})", response.status())));
    }

    let total_count = parse_total_count(response.headers());
    let rows: Vec<RawCommentRow> = response.json().await.map_err(|e| AppError::Network(format!("couldn't read the comments ({e})")))?;
    let has_more = rows.len() > limit as usize;
    let mut comments: Vec<CommunityCommentDto> = rows
        .into_iter()
        .take(limit as usize)
        .map(|row| map_comment_row(row, 0))
        .collect();

    if parent_id.is_none() {
        attach_reply_counts(&mut comments).await?;
    }

    Ok(CommentsPageDto { comments, has_more, total_count })
}

fn require_valid_reaction(reaction: i8) -> Result<(), AppError> {
    if reaction == 1 || reaction == -1 {
        Ok(())
    } else {
        Err(AppError::Input("reaction must be a like or dislike".into()))
    }
}

async fn reaction_error(response: reqwest::Response, action: &str) -> AppError {
    let status = response.status();
    let detail = response.text().await.unwrap_or_default();
    let detail = detail.trim();
    if detail.is_empty() {
        AppError::Network(format!("{action} (status {status})"))
    } else {
        AppError::Network(format!("{action} (status {status}: {detail})"))
    }
}

pub async fn set_reaction(access_token: &str, user_id: &str, config_id: &str, reaction: i8) -> Result<(), AppError> {
    require_valid_id(config_id)?;
    require_valid_id(user_id)?;
    require_valid_reaction(reaction)?;

    let response = reqwest::Client::new()
        .post(format!("{SUPABASE_URL}/rest/v1/config_votes?on_conflict=config_id,user_id"))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Prefer", "resolution=merge-duplicates,return=minimal")
        .json(&serde_json::json!({ "config_id": config_id, "vote": reaction }))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't save your reaction ({e})")))?;

    if !response.status().is_success() {
        return Err(reaction_error(response, "your reaction was rejected").await);
    }
    Ok(())
}

pub async fn fetch_my_reaction(access_token: &str, user_id: &str, config_id: &str) -> Result<Option<i8>, AppError> {
    require_valid_id(config_id)?;
    require_valid_id(user_id)?;
    let response = reqwest::Client::new()
        .get(format!(
            "{SUPABASE_URL}/rest/v1/config_votes?config_id=eq.{config_id}&user_id=eq.{user_id}&select=vote&limit=1"
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't load your reaction ({e})")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!("couldn't load your reaction (status {})", response.status())));
    }
    let rows: Vec<RawVoteRow> = response.json().await.map_err(|e| AppError::Network(format!("couldn't read your reaction ({e})")))?;
    Ok(rows.first().map(|row| row.vote))
}

pub async fn clear_reaction(access_token: &str, user_id: &str, config_id: &str) -> Result<(), AppError> {
    require_valid_id(config_id)?;
    require_valid_id(user_id)?;
    let response = reqwest::Client::new()
        .delete(format!(
            "{SUPABASE_URL}/rest/v1/config_votes?config_id=eq.{config_id}&user_id=eq.{user_id}"
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't remove your reaction ({e})")))?;

    if !response.status().is_success() {
        return Err(reaction_error(response, "removing your reaction was rejected").await);
    }
    Ok(())
}

fn validate_comment_body(body: &str) -> Result<String, AppError> {
    let trimmed = body.trim();
    if trimmed.is_empty() || trimmed.chars().count() > MAX_COMMENT_LEN {
        return Err(AppError::Input(format!("comment must be 1-{MAX_COMMENT_LEN} characters")));
    }
    Ok(trimmed.to_string())
}

pub async fn post_comment(
    access_token: &str,
    config_id: &str,
    body: &str,
    parent_id: Option<&str>,
) -> Result<(), AppError> {
    require_valid_id(config_id)?;
    if let Some(parent) = parent_id {
        require_valid_id(parent)?;
    }
    let trimmed = validate_comment_body(body)?;

    let mut payload = serde_json::json!({ "config_id": config_id, "body": trimmed });
    if let Some(parent) = parent_id {
        payload["parent_id"] = serde_json::Value::String(parent.to_string());
    }

    let response = reqwest::Client::new()
        .post(format!("{SUPABASE_URL}/rest/v1/config_comments"))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {access_token}"))
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't post your comment ({e})")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!("your comment was rejected (status {})", response.status())));
    }
    Ok(())
}

pub async fn update_comment(access_token: &str, comment_id: &str, body: &str) -> Result<(), AppError> {
    require_valid_id(comment_id)?;
    let trimmed = validate_comment_body(body)?;

    let response = reqwest::Client::new()
        .patch(format!("{SUPABASE_URL}/rest/v1/config_comments?id=eq.{comment_id}"))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {access_token}"))
        .json(&serde_json::json!({ "body": trimmed, "updated_at": chrono::Utc::now().to_rfc3339() }))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't update your comment ({e})")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!("your comment update was rejected (status {})", response.status())));
    }
    Ok(())
}

pub async fn delete_comment(access_token: &str, comment_id: &str) -> Result<(), AppError> {
    require_valid_id(comment_id)?;
    let response = reqwest::Client::new()
        .delete(format!("{SUPABASE_URL}/rest/v1/config_comments?id=eq.{comment_id}"))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't delete your comment ({e})")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!("deleting your comment was rejected (status {})", response.status())));
    }
    Ok(())
}

fn validate_config_payload(name: &str, note: &str, config_type: &str, perspective: Option<&str>) -> Result<(String, String), AppError> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > MAX_NAME_LEN {
        return Err(AppError::Input(format!("title must be 1-{MAX_NAME_LEN} characters")));
    }
    let note = note.trim();
    if note.chars().count() > MAX_DESCRIPTION_LEN {
        return Err(AppError::Input(format!("description must be at most {MAX_DESCRIPTION_LEN} characters")));
    }
    if !VALID_TYPES.contains(&config_type) {
        return Err(AppError::Input("pick a config type before posting".into()));
    }
    if let Some(perspective) = perspective {
        if config_type != "rage" {
            return Err(AppError::Input("perspective only applies to rage configs".into()));
        }
        if !VALID_PERSPECTIVES.contains(&perspective) {
            return Err(AppError::Input("pick a valid perspective".into()));
        }
    }
    Ok((name.to_string(), note.to_string()))
}

fn config_json_body(name: &str, note: &str, config_type: &str, perspective: Option<&str>, data: serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "name": name,
        "note": if note.is_empty() { serde_json::Value::Null } else { serde_json::Value::String(note.to_string()) },
        "type": config_type,
        "perspective": perspective,
        "data": data,
    })
}

pub async fn create_config(
    access_token: &str,
    name: &str,
    note: &str,
    config_type: &str,
    perspective: Option<&str>,
    data: serde_json::Value,
) -> Result<(), AppError> {
    let (name, note) = validate_config_payload(name, note, config_type, perspective)?;

    let response = reqwest::Client::new()
        .post(format!("{SUPABASE_URL}/rest/v1/configs"))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {access_token}"))
        .json(&config_json_body(&name, &note, config_type, perspective, data))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't post your config ({e})")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!("your config was rejected (status {})", response.status())));
    }
    Ok(())
}

pub async fn update_config(
    access_token: &str,
    config_id: &str,
    name: &str,
    note: &str,
    config_type: &str,
    perspective: Option<&str>,
    data: serde_json::Value,
) -> Result<(), AppError> {
    require_valid_id(config_id)?;
    let (name, note) = validate_config_payload(name, note, config_type, perspective)?;

    let response = reqwest::Client::new()
        .patch(format!("{SUPABASE_URL}/rest/v1/configs?id=eq.{config_id}"))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {access_token}"))
        .json(&config_json_body(&name, &note, config_type, perspective, data))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't update your config ({e})")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!("your config update was rejected (status {})", response.status())));
    }
    Ok(())
}

pub async fn delete_config(access_token: &str, config_id: &str) -> Result<(), AppError> {
    require_valid_id(config_id)?;
    let response = reqwest::Client::new()
        .delete(format!("{SUPABASE_URL}/rest/v1/configs?id=eq.{config_id}"))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't delete your config ({e})")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!("deleting your config was rejected (status {})", response.status())));
    }
    Ok(())
}
