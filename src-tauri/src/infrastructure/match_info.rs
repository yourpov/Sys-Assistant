use std::collections::HashMap;
use std::io::SeekFrom;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant};

use serde::Deserialize;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

use super::henrik;
use super::riot_api::LcuSession;
use super::valorant_regional::{self, CLIENT_PLATFORM, UNKNOWN_PLAYER_NAME, UNKNOWN_PLAYER_TAG};
use crate::dto::{LiveMatchSnapshotDto, MatchInfoDto, MatchPlayerDto};
use crate::error::{AppError, RiotClientError};

const AGENTS_CACHE_TTL: Duration     = Duration::from_secs(3600);
const LIVE_MATCH_CACHE_TTL: Duration = Duration::from_secs(45);
const LOG_TAIL_BYTES: u64            = 512 * 1024;

static GLZ_CLIENT: LazyLock<reqwest::Client>                      = LazyLock::new(reqwest::Client::new);
static LIVE_MATCH_CACHE: LazyLock<Mutex<Option<CachedLiveMatch>>> = LazyLock::new(|| Mutex::new(None));

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MatchFetchPhase {
    Roster,
    Ranks,
    All,
}

impl MatchFetchPhase {
    pub fn parse(value: Option<&str>) -> Self {
        match value {
            Some("roster") => Self::Roster,
            Some("ranks") => Self::Ranks,
            _ => Self::All,
        }
    }
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
    subject      : String,
    #[serde(rename = "TeamID")]
    team_id      : String,
    #[serde(rename = "CharacterID")]
    character_id : String,
}

#[derive(Debug, Deserialize)]
struct PregameMatch {
    #[serde(rename = "Teams")]
    teams: Vec<PregameTeam>,
}

#[derive(Debug, Deserialize)]
struct PregameTeam {
    #[serde(rename = "TeamID")]
    team_id : String,
    #[serde(rename = "Players")]
    players : Vec<PregamePlayer>,
}

#[derive(Debug, Deserialize)]
struct PregamePlayer {
    #[serde(rename = "Subject")]
    subject      : String,
    #[serde(rename = "CharacterID")]
    character_id : String,
}

#[derive(Debug, Deserialize)]
struct AgentsResponse {
    data: Vec<AgentData>,
}

#[derive(Debug, Deserialize)]
struct AgentData {
    uuid         : String,
    #[serde(rename = "displayName")]
    display_name : String,
    #[serde(rename = "displayIcon")]
    display_icon : String,
}

#[derive(Clone)]
struct RosterPlayer {
    puuid        : String,
    team_id      : Option<String>,
    character_id : String,
}

struct PlayerLookup {
    name          : String,
    tag           : String,
    rank          : Option<String>,
    rr            : Option<i64>,
    rank_icon_url : Option<String>,
}

#[derive(Clone)]
struct CachedLiveMatch {
    stored_at : Instant,
    in_game   : bool,
    region    : String,
    roster    : Vec<RosterPlayer>,
    players   : Vec<MatchPlayerDto>,
}

struct RiotAuth {
    access_token     : String,
    entitlements_jwt : String,
    client_version   : String,
    region           : String,
    shard            : String,
}

pub async fn detect_current_riot_id(api_keys: &[String]) -> Result<(String, String), AppError> {
    let token = LcuSession::connect().await?.entitlements_token().await?;
    let (name, tag, _) = henrik::fetch_account_by_puuid(api_keys, &token.subject).await?;
    Ok((name, tag))
}

pub async fn fetch_live_match(api_keys: &[String], phase: MatchFetchPhase) -> Result<MatchInfoDto, AppError> {
    match phase {
        MatchFetchPhase::Ranks => fetch_live_match_ranks(api_keys).await,
        MatchFetchPhase::Roster | MatchFetchPhase::All => fetch_live_match_roster(api_keys, phase == MatchFetchPhase::All).await,
    }
}

async fn fetch_live_match_ranks(api_keys: &[String]) -> Result<MatchInfoDto, AppError> {
    let cached = LIVE_MATCH_CACHE
        .lock()
        .unwrap()
        .as_ref()
        .filter(|cache| cache.stored_at.elapsed() < LIVE_MATCH_CACHE_TTL)
        .cloned();

    let Some(mut cached) = cached else {
        return Err(AppError::RiotClient("match roster expired. fetch match info again".into()));
    };

    let mut lookups = tokio::task::JoinSet::new();
    for (index, player) in cached.roster.iter().enumerate() {
        let puuid = player.puuid.clone();
        let region = cached.region.clone();
        let api_keys = api_keys.to_vec();
        lookups.spawn(async move {
            let (rank, rr, rank_icon_url) =
                henrik::fetch_rank_by_puuid(&api_keys, &region, &puuid).await.unwrap_or((None, None, None));
            (index, rank, rr, rank_icon_url)
        });
    }

    while let Some(result) = lookups.join_next().await {
        if let Ok((index, rank, rr, rank_icon_url)) = result {
            if let Some(player) = cached.players.get_mut(index) {
                player.rank = rank;
                player.rr = rr;
                player.rank_icon_url = rank_icon_url;
            }
        }
    }

    Ok(MatchInfoDto { in_game: cached.in_game, players: cached.players })
}

async fn fetch_live_match_roster(api_keys: &[String], include_ranks: bool) -> Result<MatchInfoDto, AppError> {
    let session = LcuSession::connect().await?;

    let (log_contents, entitlements) = tokio::join!(read_shooter_game_log_tail(), session.entitlements_token());
    let token = entitlements?;
    let (my_puuid, access_token, entitlements_jwt) = (token.subject, token.access_token, token.token);

    let session_for_region = session.clone();
    let (region_shard, client_version, agents, my_account) = tokio::join!(
        async move {
            if let Some(ref contents) = log_contents {
                if let Some(pair) = parse_shard_from_log(contents) {
                    return Ok(pair);
                }
            }
            let raw_region = session_for_region.region_locale().await?;
            let region = valorant_regional::normalize_region(&raw_region);
            let shard = valorant_regional::shard_for_region(&region);
            Ok((region, shard))
        },
        super::valorant_version::latest_riot_client_version(),
        fetch_agents(),
        henrik::fetch_account_by_puuid(api_keys, &my_puuid),
    );
    let (region, shard) = region_shard?;
    let client_version = client_version?;
    let agents = agents?;
    let (my_name, my_tag) = my_account
        .map(|(name, tag, _)| (name, tag))
        .unwrap_or_else(|_| (UNKNOWN_PLAYER_NAME.into(), UNKNOWN_PLAYER_TAG.into()));

    let auth = RiotAuth { access_token, entitlements_jwt, client_version, region: region.clone(), shard };
    let (in_game, roster) = fetch_roster(&GLZ_CLIENT, &auth, &my_puuid).await?;
    let my_team_id = roster.iter().find(|p| p.puuid == my_puuid).and_then(|p| p.team_id.clone());

    let non_self_puuids: Vec<String> = roster.iter().filter(|p| p.puuid != my_puuid).map(|p| p.puuid.clone()).collect();
    let batched_names = Arc::new(fetch_names_batch(&GLZ_CLIENT, &auth, &non_self_puuids).await.unwrap_or_default());

    let mut lookups = tokio::task::JoinSet::new();
    for (index, player) in roster.iter().enumerate() {
        let puuid = player.puuid.clone();
        let region = region.clone();
        let api_keys = api_keys.to_vec();
        let is_me = player.puuid == my_puuid;
        let my_name = my_name.clone();
        let my_tag = my_tag.clone();
        let batched_names = batched_names.clone();
        lookups.spawn(async move {
            let (name, tag, rank, rr, rank_icon_url) = if is_me {
                let (rank, rr, rank_icon_url) = if include_ranks {
                    henrik::fetch_rank_by_puuid(&api_keys, &region, &puuid).await.unwrap_or((None, None, None))
                } else {
                    (None, None, None)
                };
                (my_name, my_tag, rank, rr, rank_icon_url)
            } else {
                let name_task = async {
                    if let Some((name, tag)) = batched_names.get(&puuid.to_lowercase()) {
                        (name.clone(), tag.clone())
                    } else {
                        henrik::fetch_account_by_puuid(&api_keys, &puuid)
                            .await
                            .map(|(n, t, _)| (n, t))
                            .unwrap_or_else(|_| (UNKNOWN_PLAYER_NAME.into(), UNKNOWN_PLAYER_TAG.into()))
                    }
                };
                let rank_task = async {
                    if include_ranks {
                        henrik::fetch_rank_by_puuid(&api_keys, &region, &puuid).await.unwrap_or((None, None, None))
                    } else {
                        (None, None, None)
                    }
                };
                let ((name, tag), (rank, rr, rank_icon_url)) = tokio::join!(name_task, rank_task);
                (name, tag, rank, rr, rank_icon_url)
            };
            (index, PlayerLookup { name, tag, rank, rr, rank_icon_url })
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
        let PlayerLookup { name, tag, rank, rr, rank_icon_url } = lookup.unwrap_or_else(|| PlayerLookup {
            name: UNKNOWN_PLAYER_NAME.into(),
            tag: UNKNOWN_PLAYER_TAG.into(),
            rank: None,
            rr: None,
            rank_icon_url: None,
        });
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
            rank_icon_url,
            team_side,
            ally,
            agent: agent.as_ref().map(|(name, _)| name.clone()),
            agent_icon_url: agent.map(|(_, icon)| icon),
        });
    }

    if !include_ranks {
        *LIVE_MATCH_CACHE.lock().unwrap() = Some(CachedLiveMatch {
            stored_at: Instant::now(),
            in_game,
            region: region.clone(),
            roster,
            players: players.clone(),
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

const NON_MATCH_MAP_NAMES: [&str; 4] = ["Init", "MainMenuV2", "CharacterSelectPersistentLevel", "Login"];

async fn read_shooter_game_log_tail() -> Option<String> {
    let local_app_data = std::env::var_os("LOCALAPPDATA")?;
    let path = std::path::Path::new(&local_app_data).join("VALORANT").join("Saved").join("Logs").join("ShooterGame.log");
    let metadata = tokio::fs::metadata(&path).await.ok()?;
    let start = metadata.len().saturating_sub(LOG_TAIL_BYTES);
    let mut file = tokio::fs::File::open(&path).await.ok()?;
    file.seek(SeekFrom::Start(start)).await.ok()?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).await.ok()?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
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

fn parse_map_codename_from_log(contents: &str) -> Option<String> {
    const MARKER: &str = "LogMapLoadModel: Update: [Map Name: ";
    contents.lines().rev().find_map(|line| {
        let idx = line.find(MARKER)?;
        let rest = &line[idx + MARKER.len()..];
        let end = rest.find(" |")?;
        let name = &rest[..end];
        (!NON_MATCH_MAP_NAMES.contains(&name)).then(|| name.to_string())
    })
}

fn parse_completed_rounds_from_log(contents: &str) -> u32 {
    const MARKER: &str = "OnRoundEnded for round '";
    contents
        .lines()
        .rev()
        .find_map(|line| {
            let idx = line.find(MARKER)?;
            let rest = &line[idx + MARKER.len()..];
            let end = rest.find('\'')?;
            rest[..end].parse::<u32>().ok()
        })
        .map(|last_round_index| last_round_index + 1)
        .unwrap_or(0)
}

pub async fn fetch_live_match_snapshot() -> LiveMatchSnapshotDto {
    let Some(contents) = read_shooter_game_log_tail().await else {
        return LiveMatchSnapshotDto { in_match: false, map_name: None, region: None, rounds_completed: 0 };
    };

    let codename = parse_map_codename_from_log(&contents);
    let region = parse_shard_from_log(&contents).map(|(region, _)| region);
    let rounds_completed = parse_completed_rounds_from_log(&contents);
    let map_name = match &codename {
        Some(codename) => henrik::fetch_map_display_name(codename).await.or_else(|| Some(codename.clone())),
        None => None,
    };

    LiveMatchSnapshotDto { in_match: codename.is_some(), map_name, region, rounds_completed }
}

async fn fetch_roster(client: &reqwest::Client, auth: &RiotAuth, my_puuid: &str) -> Result<(bool, Vec<RosterPlayer>), AppError> {
    let (core_game_id, pregame_id) =
        tokio::join!(fetch_match_id(client, auth, "core-game", my_puuid), fetch_match_id(client, auth, "pregame", my_puuid));

    if let Some(match_id) = core_game_id? {
        let url = format!("https://glz-{}-1.{}.a.pvp.net/core-game/v1/matches/{match_id}", auth.region, auth.shard);
        let core_game: CoreGameMatch = get_json(client, &url, auth).await?;
        let roster =
            core_game.players.into_iter().map(|p| RosterPlayer { puuid: p.subject, team_id: Some(p.team_id), character_id: p.character_id }).collect();
        return Ok((true, roster));
    }

    if let Some(match_id) = pregame_id? {
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

    Err(AppError::RiotClient(RiotClientError::NotInMatch))
}

#[derive(Debug, Deserialize)]
struct NameServiceEntry {
    #[serde(rename = "Subject")]
    subject: String,
    #[serde(rename = "GameName")]
    game_name: String,
    #[serde(rename = "TagLine")]
    tag_line: String,
}

async fn fetch_names_batch(client: &reqwest::Client, auth: &RiotAuth, puuids: &[String]) -> Option<HashMap<String, (String, String)>> {
    if puuids.is_empty() {
        return Some(HashMap::new());
    }
    let url = format!("https://pd.{}.a.pvp.net/name-service/v2/players", auth.shard);
    let response = authed(client.put(&url), auth).json(puuids).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    let entries: Vec<NameServiceEntry> = response.json().await.ok()?;
    Some(entries.into_iter().map(|e| (e.subject.to_lowercase(), (e.game_name, e.tag_line))).collect())
}

async fn fetch_match_id(client: &reqwest::Client, auth: &RiotAuth, kind: &str, puuid: &str) -> Result<Option<String>, AppError> {
    let url = format!("https://glz-{}-1.{}.a.pvp.net/{kind}/v1/players/{puuid}", auth.region, auth.shard);
    let response = authed(client.get(&url), auth)
        .send()
        .await
        .map_err(|e| AppError::RiotClient(format!("couldn't reach the riot api ({e})").into()))?;
    if !response.status().is_success() {
        return Ok(None);
    }
    let parsed: MatchIdResponse =
        response.json().await.map_err(|e| AppError::RiotClient(format!("couldn't read the riot api's response ({e})").into()))?;
    Ok(Some(parsed.match_id))
}

async fn get_json<T: serde::de::DeserializeOwned>(client: &reqwest::Client, url: &str, auth: &RiotAuth) -> Result<T, AppError> {
    authed(client.get(url), auth)
        .send()
        .await
        .map_err(|e| AppError::RiotClient(format!("couldn't reach the riot api ({e})").into()))?
        .error_for_status()
        .map_err(|e| AppError::RiotClient(format!("the riot api rejected the request ({e})").into()))?
        .json::<T>()
        .await
        .map_err(|e| AppError::RiotClient(format!("couldn't read the riot api's response ({e})").into()))
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

    #[test]
    fn parses_the_map_codename_once_loaded_past_character_select() {
        let log = "LogMapLoadModel: Update: [Map Name: CharacterSelectPersistentLevel | Changed: TRUE]\n\
                   LogMapLoadModel: Update: [Map Name: Canyon | Changed: TRUE] [URL: 1.2.3.4:7023/Game/Maps/Canyon/Canyon]\n";
        assert_eq!(parse_map_codename_from_log(log), Some("Canyon".to_string()));
    }

    #[test]
    fn ignores_menu_and_loading_levels_when_finding_the_map() {
        let log = "LogMapLoadModel: Update: [Map Name: Init | Changed: TRUE]\n\
                   LogMapLoadModel: Update: [Map Name: MainMenuV2 | Changed: TRUE]\n";
        assert_eq!(parse_map_codename_from_log(log), None);
    }

    #[test]
    fn counts_completed_rounds_from_the_latest_round_ended_line() {
        let log = "LogShooterGameState: Warning: AShooterGameState::OnRoundEnded for round '0'\n\
                   LogShooterGameState: Warning: AShooterGameState::OnRoundEnded for round '1'\n";
        assert_eq!(parse_completed_rounds_from_log(log), 2);
    }

    #[test]
    fn zero_rounds_completed_when_no_round_has_ended_yet() {
        assert_eq!(parse_completed_rounds_from_log("nothing useful here"), 0);
    }
}
