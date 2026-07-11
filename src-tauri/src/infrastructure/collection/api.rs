use std::collections::HashMap;
use std::time::Duration;

use crate::error::{AppError, RiotClientError};
use crate::infrastructure::app_log::AppLogStore;
use crate::infrastructure::riot_api::{lcu_get_json, LcuSession};
use crate::infrastructure::valorant_regional::{self, CLIENT_PLATFORM};
use crate::infrastructure::valorant_version;

use super::constants::OWNED_ITEM_TYPES;
use super::types::{ChatSession, EntitlementItem, EntitlementsByType, ValorantPdAuth};

const RIOT_API_TIMEOUT: Duration = Duration::from_secs(30);

pub(crate) async fn fetch_valorant_pd_auth() -> Result<ValorantPdAuth, AppError> {
    let session = LcuSession::connect().await?;

    let (token, raw_region, client_version) = tokio::try_join!(
        session.entitlements_token(),
        session.region_locale(),
        valorant_version::riot_client_version_for_requests(),
    )?;

    let region = valorant_regional::normalize_region(&raw_region);
    let shard = valorant_regional::shard_for_region(&region);

    Ok(ValorantPdAuth {
        puuid: token.subject,
        access_token: token.access_token,
        entitlements_jwt: token.token,
        client_version,
        shard,
    })
}

pub(crate) async fn fetch_account_identity() -> (Option<String>, Option<String>) {
    match lcu_get_json::<ChatSession>("/chat/v1/session").await {
        Ok(session) => (session.game_name, session.game_tag),
        Err(_) => (None, None),
    }
}

fn entitlements_request(client: &reqwest::Client, auth: &ValorantPdAuth, url: String) -> reqwest::RequestBuilder {
    client
        .get(url)
        .header("Authorization", format!("Bearer {}", auth.access_token))
        .header("X-Riot-Entitlements-JWT", &auth.entitlements_jwt)
        .header("X-Riot-ClientPlatform", CLIENT_PLATFORM)
        .header("X-Riot-ClientVersion", &auth.client_version)
}

async fn fetch_entitlements_body(request: reqwest::RequestBuilder) -> Result<String, AppError> {
    let response = request.send().await.map_err(|e| AppError::RiotClient(RiotClientError::OwnedItemsFailed(e.to_string())))?;
    if !response.status().is_success() {
        return Err(AppError::RiotClient(RiotClientError::OwnedItemsFailed(format!(
            "riot rejected the request (HTTP {})",
            response.status().as_u16()
        ))));
    }
    response.text().await.map_err(|e| AppError::RiotClient(RiotClientError::OwnedItemsFailed(e.to_string())))
}

fn owned_item_id(entry: &EntitlementItem) -> Option<String> {
    let item_id = entry.item_id.trim();
    if !item_id.is_empty() {
        return Some(item_id.to_lowercase());
    }
    let type_id = entry.type_id.trim();
    if !type_id.is_empty() {
        return Some(type_id.to_lowercase());
    }
    None
}

pub(crate) fn extract_owned(
    raw_body: &str,
    requested_type_id: &str,
    category_by_type: &HashMap<&str, &str>,
) -> Result<Vec<(String, String)>, AppError> {
    let bucket: EntitlementsByType = serde_json::from_str(raw_body).map_err(|e| {
        AppError::RiotClient(RiotClientError::OwnedItemsFailed(format!(
            "couldn't parse riot's entitlements response ({e}, {} bytes)",
            raw_body.len()
        )))
    })?;

    let requested = requested_type_id.to_lowercase();
    let response_type = bucket.item_type_id.to_lowercase();
    let category = category_by_type
        .get(requested.as_str())
        .or_else(|| category_by_type.get(response_type.as_str()))
        .copied();

    let Some(category) = category else {
        return Ok(Vec::new());
    };

    Ok(bucket
        .entitlements
        .iter()
        .filter_map(|entry| owned_item_id(entry).map(|item_id| (item_id, category.to_string())))
        .collect())
}

const FALLBACK_SHARDS: &[&str] = &["na", "eu", "ap", "kr"];

pub(crate) async fn fetch_owned_entitlements(
    auth: &ValorantPdAuth,
    app_log: Option<&AppLogStore>,
) -> Result<Vec<(String, String)>, AppError> {
    let owned = fetch_owned_entitlements_for_shard(auth, app_log).await?;
    if !owned.is_empty() {
        return Ok(owned);
    }

    for &shard in FALLBACK_SHARDS {
        if shard.eq_ignore_ascii_case(&auth.shard) {
            continue;
        }
        let mut retry_auth = auth.clone();
        retry_auth.shard = shard.to_string();
        if let Ok(retry_owned) = fetch_owned_entitlements_for_shard(&retry_auth, app_log).await {
            if !retry_owned.is_empty() {
                if let Some(log) = app_log {
                    log.append(
                        "warn",
                        &format!(
                            "[collection entitlements] shard '{}' returned nothing, but '{shard}' had your items. \
                            the riot client's reported region was stale, likely after switching accounts.",
                            auth.shard
                        ),
                    );
                }
                return Ok(retry_owned);
            }
        }
    }

    Ok(owned)
}

async fn fetch_owned_entitlements_for_shard(
    auth: &ValorantPdAuth,
    app_log: Option<&AppLogStore>,
) -> Result<Vec<(String, String)>, AppError> {
    if let Some(log) = app_log {
        log.append(
            "debug",
            &format!("[collection entitlements] requesting shard={} puuid={} client_version={}", auth.shard, auth.puuid, auth.client_version),
        );
    }

    let category_by_type: HashMap<&str, &str> = OWNED_ITEM_TYPES.iter().copied().collect();

    let client = reqwest::Client::builder()
        .timeout(RIOT_API_TIMEOUT)
        .build()
        .map_err(|e| AppError::RiotClient(RiotClientError::OwnedItemsFailed(e.to_string())))?;

    let mut join_set = tokio::task::JoinSet::new();
    for (type_id, _category) in OWNED_ITEM_TYPES {
        let client  = client.clone();
        let auth    = auth.clone();
        let type_id = type_id.to_string();
        join_set.spawn(async move {
            let url  = format!("https://pd.{}.a.pvp.net/store/v1/entitlements/{}/{}", auth.shard, auth.puuid, type_id);
            let body = fetch_entitlements_body(entitlements_request(&client, &auth, url)).await?;
            Ok::<_, AppError>((type_id, body))
        });
    }

    let mut raw_bodies: Vec<(String, String)> = Vec::new();
    while let Some(result) = join_set.join_next().await {
        let (type_id, body) = result.map_err(|e| AppError::RiotClient(RiotClientError::OwnedItemsFailed(e.to_string())))??;
        raw_bodies.push((type_id, body));
    }

    let mut owned = Vec::new();
    for (type_id, body) in &raw_bodies {
        if let Some(log) = app_log {
            let parsed_count = serde_json::from_str::<EntitlementsByType>(body)
                .map(|bucket| bucket.entitlements.len())
                .unwrap_or(0);
            log.append(
                "debug",
                &format!("[collection entitlements] type={type_id} parsed_count={parsed_count}"),
            );
        }
        owned.extend(extract_owned(body, type_id, &category_by_type)?);
    }

    Ok(owned)
}