use std::sync::Mutex;
use std::time::{Duration, Instant};

use base64::Engine;
use serde::Deserialize;

use crate::error::{AppError, RiotClientError};

const NOT_READY_RETRY_DELAY: Duration      = Duration::from_secs(2);
const MAX_NOT_READY_RETRIES: u32           = 5;
const LCU_NOT_READY_HTTP_STATUS: [u16; 2]  = [424, 464];
const LOCKFILE_FIELD_PORT: usize           = 2;
const LOCKFILE_FIELD_PASSWORD: usize       = 3;
const LOCKFILE_FIELD_PROTOCOL: usize       = 4;
const LOGIN_CACHE_TTL: Duration            = Duration::from_millis(1500);

fn is_not_ready(status: reqwest::StatusCode) -> bool {
    LCU_NOT_READY_HTTP_STATUS.contains(&status.as_u16())
}

pub(crate) fn local_client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| AppError::RiotClient(format!("couldn't set up a connection to the riot client ({e})").into()))
}

#[derive(Debug, Clone)]
pub struct LcuCredentials {
    pub port     : String,
    pub password : String,
    pub protocol : String,
}

pub(crate) fn basic_auth_header(password: &str) -> String {
    base64::engine::general_purpose::STANDARD.encode(format!("riot:{password}"))
}

pub(crate) async fn read_lockfile() -> Result<(String, String), AppError> {
    let creds = read_lcu_credentials().await?;
    Ok((creds.port, creds.password))
}

pub async fn read_lcu_credentials() -> Result<LcuCredentials, AppError> {
    let contents = read_lockfile_contents().await?;
    parse_lockfile(&contents)
}

pub(crate) async fn read_lockfile_contents() -> Result<String, AppError> {
    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .ok_or_else(|| AppError::RiotClient("couldn't find your windows user folder (LOCALAPPDATA isn't set)".into()))?;
    let lockfile_path = std::path::Path::new(&local_app_data).join("Riot Games").join("Riot Client").join("Config").join("lockfile");
    tokio::fs::read_to_string(&lockfile_path).await.map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::RiotClient(RiotClientError::LockfileMissing),
        _ => AppError::RiotClient(format!("couldn't read the riot client's lockfile ({e})").into()),
    })
}

pub(crate) fn parse_lockfile(contents: &str) -> Result<LcuCredentials, AppError> {
    let parts: Vec<&str> = contents.trim().split(':').collect();
    let malformed = || AppError::RiotClient(RiotClientError::LockfileMalformed);
    Ok(LcuCredentials {
        port: parts.get(LOCKFILE_FIELD_PORT).ok_or_else(malformed)?.to_string(),
        password: parts.get(LOCKFILE_FIELD_PASSWORD).ok_or_else(malformed)?.to_string(),
        protocol: parts.get(LOCKFILE_FIELD_PROTOCOL).ok_or_else(malformed)?.to_string(),
    })
}

fn normalize_lcu_path(path: &str) -> String {
    if path.starts_with('/') { path.to_string() } else { format!("/{path}") }
}

#[derive(Clone)]
pub(crate) struct LcuSession {
    client      : reqwest::Client,
    base        : String,
    auth_header : String,
}

impl LcuSession {
    pub(crate) async fn connect() -> Result<Self, AppError> {
        let client = local_client()?;
        let creds  = read_lcu_credentials().await?;
        Ok(Self {
            base        : format!("{}://127.0.0.1:{}", creds.protocol, creds.port),
            auth_header : format!("Basic {}", basic_auth_header(&creds.password)),
            client,
        })
    }

    pub(crate) async fn get(&self, path: &str) -> Result<reqwest::Response, AppError> {
        self.client
            .get(format!("{}{}", self.base, normalize_lcu_path(path)))
            .header("Authorization", &self.auth_header)
            .send()
            .await
            .map_err(|e| AppError::RiotClient(RiotClientError::Unreachable(e.to_string())))
    }

    pub(crate) async fn get_json<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T, AppError> {
        let response = self.get(path).await?;
        if !response.status().is_success() {
            return Err(AppError::RiotClient(RiotClientError::Rejected(response.status().as_u16())));
        }
        response.json::<T>().await.map_err(|e| AppError::RiotClient(format!("couldn't read the riot client's response ({e})").into()))
    }

    pub(crate) async fn get_json_with_retry<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T, AppError> {
        let mut attempt = 0;
        loop {
            let response = self.get(path).await?;
            if is_not_ready(response.status()) && attempt < MAX_NOT_READY_RETRIES {
                attempt += 1;
                tokio::time::sleep(NOT_READY_RETRY_DELAY).await;
                continue;
            }
            if !response.status().is_success() {
                return Err(AppError::RiotClient(RiotClientError::Rejected(response.status().as_u16())));
            }
            return response
                .json::<T>()
                .await
                .map_err(|e| AppError::RiotClient(format!("couldn't read the riot client's response ({e})").into()));
        }
    }

    pub(crate) async fn entitlements_token(&self) -> Result<LcuEntitlementsToken, AppError> {
        self.get_json_with_retry("/entitlements/v1/token").await
    }

    pub(crate) async fn region_locale(&self) -> Result<String, AppError> {
        let response: RegionLocaleResponse = self.get_json_with_retry("/riotclient/region-locale").await?;
        Ok(response.region)
    }
}

#[derive(Debug, Deserialize)]
pub(crate) struct LcuEntitlementsToken {
    #[serde(rename = "accessToken")]
    pub(crate) access_token : String,
    pub(crate) token        : String,
    pub(crate) subject      : String,
}

#[derive(Debug, Deserialize)]
struct RegionLocaleResponse {
    region: String,
}

pub struct SessionState {
    cached: Mutex<Option<(Instant, bool)>>,
}

impl SessionState {
    pub const fn new() -> Self {
        Self { cached: Mutex::new(None) }
    }

    pub fn invalidate(&self) {
        *self.cached.lock().unwrap() = None;
    }

    pub async fn is_logged_in(&self) -> bool {
        if let Some((checked_at, value)) = *self.cached.lock().unwrap() {
            if checked_at.elapsed() < LOGIN_CACHE_TTL {
                return value;
            }
        }
        let value = probe_logged_in().await;
        *self.cached.lock().unwrap() = Some((Instant::now(), value));
        value
    }
}

impl Default for SessionState {
    fn default() -> Self {
        Self::new()
    }
}

async fn probe_logged_in() -> bool {
    let Ok(session) = LcuSession::connect().await else { return false };
    session.get("/entitlements/v1/token").await.is_ok_and(|r| r.status().is_success())
}

pub async fn launch_valorant() -> Result<(), AppError> {
    let client = local_client()?;

    let mut last_error = AppError::RiotClient("couldn't reach the riot client's local api".into());
    for attempt in 0..=MAX_NOT_READY_RETRIES {
        let (port, password) = read_lockfile().await?;
        let auth = base64::engine::general_purpose::STANDARD.encode(format!("riot:{password}"));
        let url = format!("https://127.0.0.1:{port}/product-launcher/v1/products/valorant/patchlines/live");

        let response = match post_launch(&client, &url, &auth).await {
            Ok(response) => response,
            Err(e) => {
                last_error = e;
                if attempt < MAX_NOT_READY_RETRIES {
                    tokio::time::sleep(NOT_READY_RETRY_DELAY).await;
                }
                continue;
            }
        };

        if response.status() == reqwest::StatusCode::LOCKED {
            return Ok(());
        }
        if is_not_ready(response.status()) {
            last_error = AppError::RiotClient(RiotClientError::NotReady);
            if attempt < MAX_NOT_READY_RETRIES {
                tokio::time::sleep(NOT_READY_RETRY_DELAY).await;
            }
            continue;
        }
        response
            .error_for_status()
            .map_err(|e| AppError::RiotClient(format!("the riot client's local api rejected the request to open valorant ({e})").into()))?;
        return Ok(());
    }
    Err(last_error)
}

async fn post_launch(client: &reqwest::Client, url: &str, auth: &str) -> Result<reqwest::Response, AppError> {
    client
        .post(url)
        .header("Authorization", format!("Basic {auth}"))
        .send()
        .await
        .map_err(|e| AppError::RiotClient(RiotClientError::Unreachable(e.to_string())))
}

pub async fn lcu_get_json<T: serde::de::DeserializeOwned>(path: &str) -> Result<T, AppError> {
    LcuSession::connect().await?.get_json(path).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_lockfile_credentials() {
        let parsed = parse_lockfile("Riot Client:1234:51873:password123:https").expect("lockfile");
        assert_eq!(parsed.port, "51873");
        assert_eq!(parsed.password, "password123");
        assert_eq!(parsed.protocol, "https");
    }

    #[tokio::test]
    async fn session_state_returns_the_cached_value_within_the_ttl_window() {
        let state = SessionState::new();
        *state.cached.lock().unwrap() = Some((Instant::now(), true));

        assert!(state.is_logged_in().await);
    }

    #[tokio::test]
    async fn session_state_reprobes_once_the_ttl_expires() {
        let state = SessionState::new();
        let stale_at = Instant::now() - LOGIN_CACHE_TTL - Duration::from_millis(1);
        *state.cached.lock().unwrap() = Some((stale_at, true));

        state.is_logged_in().await;

        let (refreshed_at, _) = state.cached.lock().unwrap().expect("cache should be repopulated");
        assert!(refreshed_at > stale_at);
    }
}
