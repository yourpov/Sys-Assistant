use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant};

use serde::Deserialize;

use crate::dto::{AccountLookupDto, AgentSummaryDto, MatchSummaryDto};
use crate::error::AppError;

const HENRIK_BASE: &str = "https://api.henrikdev.xyz";
const MATCH_HISTORY_SIZE: u32 = 20;
const TOP_AGENTS_SHOWN: usize = 3;
const CACHE_TTL: Duration = Duration::from_secs(120);

const RATE_LIMIT_MAX_REQUESTS: usize = 30;
const RATE_LIMIT_WINDOW: Duration = Duration::from_secs(60);

struct KeyLimiter {
    timestamps: Mutex<VecDeque<Instant>>,
    blocked_until: Mutex<Option<Instant>>,
}

impl KeyLimiter {
    fn new() -> Self {
        Self { timestamps: Mutex::new(VecDeque::new()), blocked_until: Mutex::new(None) }
    }

    fn try_acquire(&self) -> Result<(), Duration> {
        let now = Instant::now();
        if let Some(blocked_until) = *self.blocked_until.lock().unwrap() {
            if blocked_until > now {
                return Err(blocked_until - now);
            }
        }
        let mut timestamps = self.timestamps.lock().unwrap();
        while timestamps.front().is_some_and(|oldest| now.duration_since(*oldest) >= RATE_LIMIT_WINDOW) {
            timestamps.pop_front();
        }
        if timestamps.len() < RATE_LIMIT_MAX_REQUESTS {
            timestamps.push_back(now);
            Ok(())
        } else {
            Err(RATE_LIMIT_WINDOW - now.duration_since(*timestamps.front().unwrap()))
        }
    }

    fn block_for(&self, duration: Duration) {
        *self.blocked_until.lock().unwrap() = Some(Instant::now() + duration);
    }
}

static KEY_LIMITERS: LazyLock<Mutex<HashMap<String, Arc<KeyLimiter>>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

fn limiter_for(api_key: &str) -> Arc<KeyLimiter> {
    KEY_LIMITERS.lock().unwrap().entry(api_key.to_string()).or_insert_with(|| Arc::new(KeyLimiter::new())).clone()
}

async fn acquire_key(api_keys: &[String]) -> &str {
    loop {
        let mut best_wait: Option<Duration> = None;
        for api_key in api_keys {
            match limiter_for(api_key).try_acquire() {
                Ok(()) => return api_key,
                Err(wait) => {
                    if best_wait.is_none_or(|best| wait < best) {
                        best_wait = Some(wait);
                    }
                }
            }
        }
        tokio::time::sleep(best_wait.unwrap_or(DEFAULT_RETRY_AFTER)).await;
    }
}

struct TtlCache<T: Clone> {
    entries: Mutex<HashMap<String, (Instant, T)>>,
}

impl<T: Clone> TtlCache<T> {
    fn new() -> Self {
        Self { entries: Mutex::new(HashMap::new()) }
    }

    fn get(&self, key: &str) -> Option<T> {
        let entries = self.entries.lock().unwrap();
        entries.get(key).filter(|(inserted, _)| inserted.elapsed() < CACHE_TTL).map(|(_, value)| value.clone())
    }

    fn set(&self, key: String, value: T) {
        self.entries.lock().unwrap().insert(key, (Instant::now(), value));
    }
}

static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(reqwest::Client::new);

static ACCOUNT_LOOKUP_CACHE: LazyLock<TtlCache<AccountLookupDto>> = LazyLock::new(TtlCache::new);
static ACCOUNT_BY_PUUID_CACHE: LazyLock<TtlCache<(String, String, String)>> = LazyLock::new(TtlCache::new);
static RANK_BY_PUUID_CACHE: LazyLock<TtlCache<(Option<String>, Option<i64>)>> = LazyLock::new(TtlCache::new);

#[derive(Debug, Deserialize)]
struct AccountResponse {
    data: AccountData,
}

#[derive(Debug, Deserialize)]
struct AccountData {
    region: String,
    account_level: u32,
    name: String,
    tag: String,
    card: Card,
    last_update: String,
}

#[derive(Debug, Deserialize)]
struct Card {
    large: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MmrResponse {
    data: MmrData,
}

#[derive(Debug, Deserialize)]
struct MmrData {
    current_data: Option<CurrentData>,
    highest_rank: Option<HighestRank>,
}

#[derive(Debug, Deserialize)]
struct CurrentData {
    currenttierpatched: Option<String>,
    ranking_in_tier: Option<i64>,
    elo: Option<i64>,
    images: Option<Images>,
}

#[derive(Debug, Deserialize)]
struct Images {
    large: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HighestRank {
    patched_tier: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MatchesResponse {
    data: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct MatchData {
    metadata: MatchMetadata,
    players: MatchPlayers,
    teams: MatchTeams,
}

#[derive(Debug, Deserialize)]
struct MatchMetadata {
    map: String,
    mode: Option<String>,
    game_start: i64,
}

#[derive(Debug, Deserialize)]
struct MatchPlayers {
    all_players: Vec<MatchPlayer>,
}

#[derive(Debug, Deserialize)]
struct MatchPlayer {
    name: String,
    tag: String,
    team: Option<String>,
    character: Option<String>,
    assets: Option<MatchPlayerAssets>,
    stats: MatchPlayerStats,
}

#[derive(Debug, Deserialize)]
struct MatchPlayerAssets {
    agent: Option<AgentIcon>,
}

#[derive(Debug, Deserialize)]
struct AgentIcon {
    small: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MatchPlayerStats {
    kills: i64,
    deaths: i64,
    assists: i64,
    headshots: i64,
    bodyshots: i64,
    legshots: i64,
}

#[derive(Debug, Deserialize)]
struct MatchTeams {
    red: Option<MatchTeamResult>,
    blue: Option<MatchTeamResult>,
}

#[derive(Debug, Deserialize)]
struct MatchTeamResult {
    has_won: Option<bool>,
    rounds_won: Option<i64>,
}

pub async fn fetch_account_lookup(api_keys: &[String], name: &str, tag: &str) -> Result<AccountLookupDto, AppError> {
    let cache_key = format!("{}#{}", name.to_lowercase(), tag.to_lowercase());
    if let Some(cached) = ACCOUNT_LOOKUP_CACHE.get(&cache_key) {
        return Ok(cached);
    }

    let account_url = build_url(&["valorant", "v1", "account", name, tag])?;
    let account: AccountResponse = fetch_json(&HTTP_CLIENT, api_keys, account_url).await?;
    let region = account.data.region.clone();

    let mmr_url = build_url(&["valorant", "v2", "mmr", &region, name, tag])?;
    let rank: Option<MmrResponse> = fetch_json(&HTTP_CLIENT, api_keys, mmr_url).await.ok();

    let current = rank.as_ref().and_then(|r| r.data.current_data.as_ref());
    let highest = rank.as_ref().and_then(|r| r.data.highest_rank.as_ref());

    let mut matches_url = build_url(&["valorant", "v3", "matches", &region, name, tag])?;
    matches_url.query_pairs_mut().append_pair("size", &MATCH_HISTORY_SIZE.to_string());
    let matches: Option<MatchesResponse> = fetch_json(&HTTP_CLIENT, api_keys, matches_url).await.ok();
    let parsed_matches: Vec<MatchData> = matches
        .map(|m| m.data.into_iter().filter_map(|raw| serde_json::from_value::<MatchData>(raw).ok()).collect())
        .unwrap_or_default();
    let history = summarize_matches(&parsed_matches, name, tag);

    let result = AccountLookupDto {
        name: account.data.name,
        tag: account.data.tag,
        region,
        account_level: account.data.account_level,
        card_url: account.data.card.large.unwrap_or_default(),
        last_update: account.data.last_update,
        rank: current.and_then(|c| c.currenttierpatched.clone()),
        rank_icon_url: current.and_then(|c| c.images.as_ref()).and_then(|i| i.large.clone()),
        rr: current.and_then(|c| c.ranking_in_tier),
        elo: current.and_then(|c| c.elo),
        peak_rank: highest.and_then(|h| h.patched_tier.clone()),
        games_played: history.games_played,
        win_rate: history.win_rate,
        kda: history.kda,
        avg_hs_percent: history.avg_hs_percent,
        total_kills: history.total_kills,
        total_deaths: history.total_deaths,
        total_assists: history.total_assists,
        top_agents: history.top_agents,
        recent_matches: history.recent_matches,
    };
    ACCOUNT_LOOKUP_CACHE.set(cache_key, result.clone());
    Ok(result)
}

pub(crate) async fn fetch_account_by_puuid(api_keys: &[String], puuid: &str) -> Result<(String, String, String), AppError> {
    if let Some(cached) = ACCOUNT_BY_PUUID_CACHE.get(puuid) {
        return Ok(cached);
    }
    let url = build_url(&["valorant", "v1", "by-puuid", "account", puuid])?;
    let account: AccountResponse = fetch_json(&HTTP_CLIENT, api_keys, url).await?;
    let result = (account.data.name, account.data.tag, account.data.region);
    ACCOUNT_BY_PUUID_CACHE.set(puuid.to_string(), result.clone());
    Ok(result)
}

pub(crate) async fn fetch_rank_by_puuid(api_keys: &[String], region: &str, puuid: &str) -> Result<(Option<String>, Option<i64>), AppError> {
    let cache_key = format!("{region}:{puuid}");
    if let Some(cached) = RANK_BY_PUUID_CACHE.get(&cache_key) {
        return Ok(cached);
    }
    let url = build_url(&["valorant", "v2", "by-puuid", "mmr", region, puuid])?;
    let mmr: MmrResponse = fetch_json(&HTTP_CLIENT, api_keys, url).await?;
    let current = mmr.data.current_data.as_ref();
    let result = (current.and_then(|c| c.currenttierpatched.clone()), current.and_then(|c| c.ranking_in_tier));
    RANK_BY_PUUID_CACHE.set(cache_key, result.clone());
    Ok(result)
}

fn build_url(segments: &[&str]) -> Result<reqwest::Url, AppError> {
    let mut url = reqwest::Url::parse(HENRIK_BASE).map_err(|e| AppError::Network(format!("couldn't build the api request ({e})")))?;
    url.path_segments_mut().map_err(|_| AppError::Network("couldn't build the api request".into()))?.extend(segments);
    Ok(url)
}

#[derive(Default)]
struct MatchHistorySummary {
    games_played: i64,
    win_rate: i64,
    kda: f64,
    avg_hs_percent: i64,
    total_kills: i64,
    total_deaths: i64,
    total_assists: i64,
    top_agents: Vec<AgentSummaryDto>,
    recent_matches: Vec<MatchSummaryDto>,
}

struct AgentTally {
    agent_icon_url: String,
    games: i64,
    wins: i64,
    kills: i64,
    deaths: i64,
}

fn summarize_matches(matches: &[MatchData], name: &str, tag: &str) -> MatchHistorySummary {
    let mut total_kills = 0;
    let mut total_deaths = 0;
    let mut total_assists = 0;
    let mut total_hs = 0;
    let mut total_shots = 0;
    let mut wins = 0;
    let mut losses = 0;
    let mut draws = 0;
    let mut agent_tallies: HashMap<String, AgentTally> = HashMap::new();
    let mut recent_matches = Vec::new();

    for game in matches {
        let Some(player) = game.players.all_players.iter().find(|p| p.name.eq_ignore_ascii_case(name) && p.tag.eq_ignore_ascii_case(tag)) else {
            continue;
        };

        let team_name = player.team.as_deref().unwrap_or_default().to_lowercase();
        let team_result = match team_name.as_str() {
            "red" => game.teams.red.as_ref(),
            "blue" => game.teams.blue.as_ref(),
            _ => None,
        };
        let enemy_result = match team_name.as_str() {
            "red" => game.teams.blue.as_ref(),
            "blue" => game.teams.red.as_ref(),
            _ => None,
        };

        let (result, team_score, enemy_score) = match (team_result, enemy_result) {
            (Some(team), Some(enemy)) => match (team.has_won, team.rounds_won, enemy.rounds_won) {
                (Some(_), Some(team_rounds), Some(enemy_rounds)) if team_rounds == enemy_rounds => ("Draw", team_rounds, enemy_rounds),
                (Some(true), Some(team_rounds), Some(enemy_rounds)) => ("Win", team_rounds, enemy_rounds),
                (Some(false), Some(team_rounds), Some(enemy_rounds)) => ("Loss", team_rounds, enemy_rounds),
                _ => ("Unknown", 0, 0),
            },
            _ => ("Unknown", 0, 0),
        };
        match result {
            "Win" => wins += 1,
            "Loss" => losses += 1,
            "Draw" => draws += 1,
            _ => {}
        }

        let shots = player.stats.headshots + player.stats.bodyshots + player.stats.legshots;
        let hs_percent = if shots > 0 { (player.stats.headshots * 100) / shots } else { 0 };

        total_kills += player.stats.kills;
        total_deaths += player.stats.deaths;
        total_assists += player.stats.assists;
        total_hs += player.stats.headshots;
        total_shots += shots;

        let character = player.character.clone().unwrap_or_else(|| "Unknown".to_string());
        let agent_icon_url = player.assets.as_ref().and_then(|a| a.agent.as_ref()).and_then(|a| a.small.clone()).unwrap_or_default();

        let tally = agent_tallies.entry(character.clone()).or_insert_with(|| AgentTally {
            agent_icon_url: agent_icon_url.clone(),
            games: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
        });
        tally.games += 1;
        if result == "Win" {
            tally.wins += 1;
        }
        tally.kills += player.stats.kills;
        tally.deaths += player.stats.deaths;

        recent_matches.push(MatchSummaryDto {
            map: game.metadata.map.clone(),
            mode: game.metadata.mode.clone().unwrap_or_else(|| "Custom".to_string()),
            date: game.metadata.game_start * 1000,
            result: result.to_string(),
            kills: player.stats.kills,
            deaths: player.stats.deaths,
            assists: player.stats.assists,
            hs_percent,
            team_score,
            enemy_score,
            agent: character,
            agent_icon_url,
        });
    }

    let games_played = wins + losses + draws;
    let win_rate = if games_played > 0 { (wins * 100) / games_played } else { 0 };
    let kda = if total_deaths > 0 { (total_kills + total_assists) as f64 / total_deaths as f64 } else { (total_kills + total_assists) as f64 };
    let avg_hs_percent = if total_shots > 0 { (total_hs * 100) / total_shots } else { 0 };

    let mut top_agents: Vec<AgentSummaryDto> = agent_tallies
        .into_iter()
        .map(|(agent, tally)| AgentSummaryDto {
            agent,
            agent_icon_url: tally.agent_icon_url,
            games: tally.games,
            wins: tally.wins,
            kills: tally.kills,
            deaths: tally.deaths,
        })
        .collect();
    top_agents.sort_by_key(|a| std::cmp::Reverse(a.games));
    top_agents.truncate(TOP_AGENTS_SHOWN);

    MatchHistorySummary { games_played, win_rate, kda, avg_hs_percent, total_kills, total_deaths, total_assists, top_agents, recent_matches }
}

const MAX_RATE_LIMIT_RETRIES: u32 = 6;
const DEFAULT_RETRY_AFTER: Duration = Duration::from_secs(5);

async fn fetch_json<T: serde::de::DeserializeOwned>(client: &reqwest::Client, api_keys: &[String], url: reqwest::Url) -> Result<T, AppError> {
    if api_keys.is_empty() {
        return Err(AppError::Network("no henrikdev api key configured. add one in settings".into()));
    }

    let mut attempt = 0;
    let response = loop {
        let api_key = acquire_key(api_keys).await;

        let response = client
            .get(url.clone())
            .header("Authorization", api_key)
            .send()
            .await
            .map_err(|e| AppError::Network(format!("couldn't reach the api ({e})")))?;

        if response.status().as_u16() == 429 && attempt < MAX_RATE_LIMIT_RETRIES {
            attempt += 1;
            limiter_for(api_key).block_for(retry_after(&response));
            continue;
        }
        break response;
    };

    let status = response.status();
    if !status.is_success() {
        return Err(match status.as_u16() {
            401 => AppError::Network("your henrikdev api key is invalid. check it in settings, then try again".into()),
            404 => AppError::Network("player not found".into()),
            429 => AppError::Network("api is rate limited. try again later".into()),
            _ => AppError::Network(format!("api error ({status})")),
        });
    }

    response.json::<T>().await.map_err(|e| AppError::Network(format!("couldn't read the api's response ({e})")))
}

fn retry_after(response: &reqwest::Response) -> Duration {
    if let Some(seconds) = header_value(response, "retry-after").and_then(|v| v.parse::<u64>().ok()) {
        return Duration::from_secs(seconds);
    }
    if let Some(seconds) = header_value(response, "ratelimit").and_then(|v| parse_ratelimit_field(&v, "t")) {
        return Duration::from_secs(seconds);
    }
    DEFAULT_RETRY_AFTER
}

fn header_value(response: &reqwest::Response, name: &str) -> Option<String> {
    response.headers().get(name)?.to_str().ok().map(str::to_string)
}

fn parse_ratelimit_field(header: &str, field: &str) -> Option<u64> {
    let prefix = format!("{field}=");
    header.split(';').find_map(|part| part.trim().strip_prefix(&prefix)?.parse::<u64>().ok())
}
