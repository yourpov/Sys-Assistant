use base64::Engine;
use serde::Deserialize;

use crate::dto::AppCreditDto;
use crate::error::AppError;

const CREDIT_DISCORD_ID: &str         = "1470172610636808425";
const CUSTOM_STATUS_ACTIVITY_TYPE: u8 = 4;

#[derive(Debug, Deserialize)]
struct LanyardResponse {
    success : bool,
    data    : Option<LanyardData>,
}

#[derive(Debug, Deserialize)]
struct LanyardData {
    discord_user   : DiscordUser,
    discord_status : String,
    activities     : Vec<Activity>,
}

#[derive(Debug, Deserialize)]
struct DiscordUser {
    id                     : String,
    username               : String,
    global_name            : Option<String>,
    avatar                 : Option<String>,
    avatar_decoration_data : Option<AvatarDecoration>,
}

#[derive(Debug, Deserialize)]
struct AvatarDecoration {
    asset: String,
}

#[derive(Debug, Deserialize)]
struct Activity {
    #[serde(rename = "type")]
    kind  : u8,
    state : Option<String>,
}

pub async fn fetch_app_credit() -> Result<AppCreditDto, AppError> {
    let client = reqwest::Client::new();

    let response = client
        .get(format!("https://api.lanyard.rest/v1/users/{CREDIT_DISCORD_ID}"))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't reach lanyard ({e})")))?;
    let parsed: LanyardResponse = response.json().await.map_err(|e| AppError::Network(format!("couldn't read lanyard's response ({e})")))?;
    let data = parsed.data.filter(|_| parsed.success).ok_or_else(|| AppError::Network("lanyard has no data for this user".into()))?;

    let avatar_url = match &data.discord_user.avatar {
        Some(hash) => format!("https://cdn.discordapp.com/avatars/{}/{hash}.png?size=128", data.discord_user.id),
        None => "https://cdn.discordapp.com/embed/avatars/0.png".to_string(),
    };
    let avatar_data_url = fetch_as_data_url(&client, &avatar_url).await?;

    let decoration_data_url = match &data.discord_user.avatar_decoration_data {
        Some(decoration) => Some(fetch_as_data_url(&client, &format!("https://cdn.discordapp.com/avatar-decoration-presets/{}.png", decoration.asset)).await?),
        None => None,
    };

    let activity_text = data.activities.iter().find(|a| a.kind == CUSTOM_STATUS_ACTIVITY_TYPE).and_then(|a| a.state.clone());

    Ok(AppCreditDto {
        username     : data.discord_user.username.clone(),
        display_name : data.discord_user.global_name.unwrap_or(data.discord_user.username),
        avatar_data_url,
        decoration_data_url,
        status: data.discord_status,
        activity_text,
    })
}

async fn fetch_as_data_url(client: &reqwest::Client, url: &str) -> Result<String, AppError> {
    let response = client.get(url).send().await.map_err(|e| AppError::Network(format!("couldn't download {url} ({e})")))?;
    let content_type = response.headers().get("content-type").and_then(|v| v.to_str().ok()).unwrap_or("image/png").to_string();
    let bytes = response.bytes().await.map_err(|e| AppError::Network(format!("couldn't read {url} ({e})")))?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{content_type};base64,{encoded}"))
}
