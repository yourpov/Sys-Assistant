use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use base64::Engine;
use serde::Deserialize;

use super::henrik;
use super::riot_api::{local_client, read_lockfile};
use crate::dto::{MatchInfoDto, MatchPlayerDto};
use crate::error::AppError;

const CLIENT_PLATFORM: &str = "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";
const NOT_IN_A_MATCH: &str = "you're not in a game or agent select. open valorant and get into a match, then try again";
const AGENTS_CACHE_TTL: Duration = Duration::from_secs(3600);

#[derive(Debug, Deserialize)]
struct EntitlementsResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
    token: String,
    subject: String,
}

#[derive(Debug, Deserialize)]
struct RegionLocaleResponse {
    region: String,
}

#[derive(Debug, Deserialize)]
struct VersionResponse {
    data: VersionData,
}

#[derive(Debug, Deserialize)]
struct VersionData {
    #[serde(rename = "riotClientVersion")]
    riot_client_version: String,
}

#[derive(Debug, Deserialize)]
struct MatchIdResponse {
    #[serde(rename = "MatchID")]
    match_id: String,
}

#[derive(Debug, Deserialize)]
struct CoreGameMatch {
    #[serde(rename = "Players")]
    players: Vec<CoreGamePlayer>,
}

#[derive(Debug, Deserialize)]
struct CoreGamePlayer {
    #[serde(rename = "Subject")]
    subject: String,
    #[serde(rename = "TeamID")]
    team_id: String,
    #[serde(rename = "CharacterID")]
    character_id: String,
}

#[derive(Debug, Deserialize)]
struct PregameMatch {
    #[serde(rename = "Teams")]
    teams: Vec<PregameTeam>,
}

#[derive(Debug, Deserialize)]
struct PregameTeam {
    #[serde(rename = "TeamID")]
    team_id: String,
    #[serde(rename = "Players")]
    players: Vec<PregamePlayer>,
}

#[derive(Debug, Deserialize)]
struct PregamePlayer {
    #[serde(rename = "Subject")]
    subject: String,
    #[serde(rename = "CharacterID")]
    character_id: String,
}

#[derive(Debug, Deserialize)]
struct AgentsResponse {
    data: Vec<AgentData>,
}

#[derive(Debug, Deserialize)]
struct AgentData {
    uuid: String,
    #[serde(rename = "displayName")]
    display_name: String,
    #[serde(rename = "displayIcon")]
    display_icon: String,
}

struct RosterPlayer {
    puuid: String,
    team_id: Option<String>,
    character_id: String,
}

struct PlayerLookup {
    name: String,
    tag: String,
    rank: Option<String>,
    rr: Option<i64>,
}

struct RiotAuth {
    access_token: String,
    entitlements_jwt: String,
    client_version: String,
    region: String,
    shard: String,
}

pub async fn fetch_live_match(api_keys: &[String]) -> Result<MatchInfoDto, AppError> {
    let local = local_client()?;
    let (port, password) = read_lockfile().await?;
    let basic_auth = base64::engine::general_purpose::STANDARD.encode(format!("riot:{password}"));

    let (my_puuid, access_token, entitlements_jwt) = fetch_entitlements(&local, &port, &basic_auth).await?;
    let (region, shard) = match parse_shard_from_valorant_log().await {
        Some(pair) => pair,
        None => {
            let raw_region = fetch_region(&local, &port, &basic_auth).await?;
            let region = normalize_region(&raw_region);
            let shard = shard_for_region(&region);
            (region, shard)
        }
    };
    let client_version = fetch_client_version().await?;

    let glz = reqwest::Client::new();
    let auth = RiotAuth { access_token, entitlements_jwt, client_version, region: region.clone(), shard };

    let (in_game, roster) = fetch_roster(&glz, &auth, &my_puuid).await?;
    let my_team_id = roster.iter().find(|p| p.puuid == my_puuid).and_then(|p| p.team_id.clone());

    let (my_name, my_tag, _) = henrik::fetch_account_by_puuid(api_keys, &my_puuid).await?;
    let agents = fetch_agents().await?;

    let mut lookups = tokio::task::JoinSet::new();
    for (index, player) in roster.iter().enumerate() {
        let puuid = player.puuid.clone();
        let region = region.clone();
        let api_keys = api_keys.to_vec();
        let is_me = player.puuid == my_puuid;
        let my_name = my_name.clone();
        let my_tag = my_tag.clone();
        lookups.spawn(async move {
            let (name, tag) = if is_me {
                (my_name, my_tag)
            } else {
                henrik::fetch_account_by_puuid(&api_keys, &puuid).await.map(|(n, t, _)| (n, t)).unwrap_or_else(|_| ("Unknown".into(), "????".into()))
            };
            let (rank, rr) = henrik::fetch_rank_by_puuid(&api_keys, &region, &puuid).await.unwrap_or((None, None));
            (index, PlayerLookup { name, tag, rank, rr })
        });
    }

    let mut resolved: Vec<Option<PlayerLookup>> = (0..roster.len()).map(|_| None).collect();
    while let Some(result) = lookups.join_next().await {
        if let Ok((index, lookup)) = result {
            resolved[index] = Some(lookup);
        }
    }

    let mut players = Vec::with_capacity(roster.len());
    for (player, lookup) in roster.iter().zip(resolved) {
        let PlayerLookup { name, tag, rank, rr } = lookup.unwrap_or_else(|| PlayerLookup { name: "Unknown".into(), tag: "????".into(), rank: None, rr: None });
        let team_side = player.team_id.as_deref().map(|team_id| match team_id {
            "Blue" => "Defense".to_string(),
            "Red" => "Attack".to_string(),
            other => other.to_string(),
        });
        let ally = match (&player.team_id, &my_team_id) {
            (Some(team_id), Some(my_team_id)) => team_id == my_team_id,
            _ => true,
        };
        let agent = agents.get(&player.character_id.to_lowercase()).cloned();

        players.push(MatchPlayerDto {
            name,
            tag,
            rank,
            rr,
            team_side,
            ally,
            agent: agent.as_ref().map(|(name, _)| name.clone()),
            agent_icon_url: agent.map(|(_, icon)| icon),
        });
    }

    Ok(MatchInfoDto { in_game, players })
}

type AgentMap = HashMap<String, (String, String)>;

static AGENTS_CACHE: LazyLock<Mutex<Option<(Instant, AgentMap)>>> = LazyLock::new(|| Mutex::new(None));

async fn fetch_agents() -> Result<AgentMap, AppError> {
    if let Some((inserted, agents)) = AGENTS_CACHE.lock().unwrap().as_ref() {
        if inserted.elapsed() < AGENTS_CACHE_TTL {
            return Ok(agents.clone());
        }
    }

    let response = reqwest::get("https://valorant-api.com/v1/agents?isPlayableCharacter=true")
        .await
        .map_err(|e| AppError::Network(format!("couldn't fetch the agent list ({e})")))?
        .json::<AgentsResponse>()
        .await
        .map_err(|e| AppError::Network(format!("couldn't read the agent list ({e})")))?;
    let agents: AgentMap = response.data.into_iter().map(|a| (a.uuid.to_lowercase(), (a.display_name, a.display_icon))).collect();
    *AGENTS_CACHE.lock().unwrap() = Some((Instant::now(), agents.clone()));
    Ok(agents)
}

async fn parse_shard_from_valorant_log() -> Option<(String, String)> {
    let local_app_data = std::env::var_os("LOCALAPPDATA")?;
    let path = std::path::Path::new(&local_app_data).join("VALORANT").join("Saved").join("Logs").join("ShooterGame.log");
    let bytes = tokio::fs::read(&path).await.ok()?;
    let contents = String::from_utf8_lossy(&bytes);
    parse_shard_from_log(&contents)
}

fn parse_shard_from_log(contents: &str) -> Option<(String, String)> {
    let idx = contents.rfind("glz-")?;
    let rest = &contents[idx..];
    let end = rest.find(".a.pvp.net")?;
    let host = &rest[..end];
    let mut parts = host.split('.');
    let region_segment = parts.next()?;
    let shard = parts.next()?.to_string();
    let region = region_segment.split('-').nth(1)?.to_string();
    Some((region, shard))
}

fn normalize_region(region: &str) -> String {
    match region.to_lowercase().as_str() {
        "eu" | "euw" | "eune" | "eun" | "tr" | "ru" => "eu",
        "ap" | "oce" | "sea" | "th" | "sg" | "tw" | "vn" | "id" | "ph" | "jp" => "ap",
        "latam" | "la1" | "la2" => "latam",
        "br" | "br1" => "br",
        "kr" => "kr",
        _ => "na",
    }
    .to_string()
}

fn shard_for_region(region: &str) -> String {
    match region {
        "latam" | "br" => "na",
        other => other,
    }
    .to_string()
}

async fn fetch_entitlements(client: &reqwest::Client, port: &str, basic_auth: &str) -> Result<(String, String, String), AppError> {
    let url = format!("https://127.0.0.1:{port}/entitlements/v1/token");
    let response = client
        .get(&url)
        .header("Authorization", format!("Basic {basic_auth}"))
        .send()
        .await
        .map_err(|_| AppError::RiotClient(NOT_IN_A_MATCH.into()))?
        .error_for_status()
        .map_err(|_| AppError::RiotClient(NOT_IN_A_MATCH.into()))?;
    let entitlements: EntitlementsResponse =
        response.json().await.map_err(|e| AppError::RiotClient(format!("couldn't read the riot client's response ({e})")))?;
    Ok((entitlements.subject, entitlements.access_token, entitlements.token))
}

async fn fetch_region(client: &reqwest::Client, port: &str, basic_auth: &str) -> Result<String, AppError> {
    let url = format!("https://127.0.0.1:{port}/riotclient/region-locale");
    let response = client
        .get(&url)
        .header("Authorization", format!("Basic {basic_auth}"))
        .send()
        .await
        .map_err(|e| AppError::RiotClient(format!("couldn't reach the riot client's local api ({e})")))?
        .error_for_status()
        .map_err(|e| AppError::RiotClient(format!("the riot client's local api rejected the request ({e})")))?;
    let region: RegionLocaleResponse =
        response.json().await.map_err(|e| AppError::RiotClient(format!("couldn't read the riot client's response ({e})")))?;
    Ok(region.region)
}

async fn fetch_client_version() -> Result<String, AppError> {
    let response = reqwest::get("https://valorant-api.com/v1/version")
        .await
        .map_err(|e| AppError::Network(format!("couldn't fetch the current valorant client version ({e})")))?
        .json::<VersionResponse>()
        .await
        .map_err(|e| AppError::Network(format!("couldn't read the current valorant client version ({e})")))?;
    Ok(response.data.riot_client_version)
}

async fn fetch_roster(client: &reqwest::Client, auth: &RiotAuth, my_puuid: &str) -> Result<(bool, Vec<RosterPlayer>), AppError> {
    if let Some(match_id) = fetch_match_id(client, auth, "core-game", my_puuid).await? {
        let url = format!("https://glz-{}-1.{}.a.pvp.net/core-game/v1/matches/{match_id}", auth.region, auth.shard);
        let core_game: CoreGameMatch = get_json(client, &url, auth).await?;
        let roster =
            core_game.players.into_iter().map(|p| RosterPlayer { puuid: p.subject, team_id: Some(p.team_id), character_id: p.character_id }).collect();
        return Ok((true, roster));
    }

    if let Some(match_id) = fetch_match_id(client, auth, "pregame", my_puuid).await? {
        let url = format!("https://glz-{}-1.{}.a.pvp.net/pregame/v1/matches/{match_id}", auth.region, auth.shard);
        let pregame: PregameMatch = get_json(client, &url, auth).await?;
        let roster = pregame
            .teams
            .into_iter()
            .flat_map(|t| {
                t.players.into_iter().map(move |p| RosterPlayer { puuid: p.subject, team_id: Some(t.team_id.clone()), character_id: p.character_id })
            })
            .collect();
        return Ok((false, roster));
    }

    Err(AppError::RiotClient("you're not in a game or agent select right now. get into a match, then try again".into()))
}

async fn fetch_match_id(client: &reqwest::Client, auth: &RiotAuth, kind: &str, puuid: &str) -> Result<Option<String>, AppError> {
    let url = format!("https://glz-{}-1.{}.a.pvp.net/{kind}/v1/players/{puuid}", auth.region, auth.shard);
    let response = authed(client.get(&url), auth)
        .send()
        .await
        .map_err(|e| AppError::RiotClient(format!("couldn't reach the riot api ({e})")))?;
    if !response.status().is_success() {
        return Ok(None);
    }
    let parsed: MatchIdResponse = response.json().await.map_err(|e| AppError::RiotClient(format!("couldn't read the riot api's response ({e})")))?;
    Ok(Some(parsed.match_id))
}

async fn get_json<T: serde::de::DeserializeOwned>(client: &reqwest::Client, url: &str, auth: &RiotAuth) -> Result<T, AppError> {
    authed(client.get(url), auth)
        .send()
        .await
        .map_err(|e| AppError::RiotClient(format!("couldn't reach the riot api ({e})")))?
        .error_for_status()
        .map_err(|e| AppError::RiotClient(format!("the riot api rejected the request ({e})")))?
        .json::<T>()
        .await
        .map_err(|e| AppError::RiotClient(format!("couldn't read the riot api's response ({e})")))
}

fn authed(builder: reqwest::RequestBuilder, auth: &RiotAuth) -> reqwest::RequestBuilder {
    builder
        .header("Authorization", format!("Bearer {}", auth.access_token))
        .header("X-Riot-Entitlements-JWT", &auth.entitlements_jwt)
        .header("X-Riot-ClientPlatform", CLIENT_PLATFORM)
        .header("X-Riot-ClientVersion", &auth.client_version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_shard_from_a_log_line() {
        let log = "LogShooterGame: Display: Connecting to https://glz-eu-1.eu.a.pvp.net/some/path for stuff\n";
        assert_eq!(parse_shard_from_log(log), Some(("eu".to_string(), "eu".to_string())));
    }

    #[test]
    fn uses_the_latest_shard_when_multiple_are_present() {
        let log = "https://glz-na-1.na.a.pvp.net/old\nhttps://glz-latam-1.na.a.pvp.net/new\n";
        assert_eq!(parse_shard_from_log(log), Some(("latam".to_string(), "na".to_string())));
    }

    #[test]
    fn returns_none_when_no_glz_host_is_present() {
        assert_eq!(parse_shard_from_log("nothing useful here"), None);
    }
}
