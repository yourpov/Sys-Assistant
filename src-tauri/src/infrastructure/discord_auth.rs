use base64::Engine;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::AppError;

pub(crate) const SUPABASE_URL: &str = "https://ykzpldiiygssqtcmvlvn.supabase.co";
pub(crate) const SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrenBsZGlpeWdzc3F0Y212bHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTU3OTYsImV4cCI6MjA5ODIzMTc5Nn0.D8aLfYo9vd-dU4ZoFfQ_qnMfVRcYAjf4AikhjmdBog0";
const DEEP_LINK_REDIRECT_ENCODED: &str = "sysautomate%3A%2F%2Fauth-callback";

pub struct PkceChallenge {
    pub verifier  : String,
    pub challenge : String,
}

pub fn generate_pkce_challenge() -> PkceChallenge {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let verifier = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes);
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    PkceChallenge { verifier, challenge }
}

pub fn build_authorize_url(code_challenge: &str) -> String {
    format!(
        "{SUPABASE_URL}/auth/v1/authorize?provider=discord&redirect_to={DEEP_LINK_REDIRECT_ENCODED}&code_challenge={code_challenge}&code_challenge_method=s256"
    )
}

pub fn parse_auth_code(callback_url: &str) -> Option<String> {
    let query = callback_url.split('?').nth(1)?;
    query.split('&').find_map(|pair| pair.strip_prefix("code=").map(|code| code.to_string()))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub access_token       : String,
    pub refresh_token      : String,
    pub expires_at         : i64,
    pub user_id            : String,
    pub discord_user_id    : Option<String>,
    pub discord_username   : Option<String>,
    pub discord_avatar_url : Option<String>,
    pub is_guest           : bool,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token  : String,
    refresh_token : String,
    expires_in    : i64,
    user          : SupabaseUser,
}

#[derive(Deserialize)]
struct SupabaseUser {
    id            : String,
    #[serde(default)]
    is_anonymous  : bool,
    #[serde(default)]
    user_metadata : UserMetadata,
}

#[derive(Deserialize, Default)]
struct UserMetadata {
    full_name  : Option<String>,
    name       : Option<String>,
    user_name  : Option<String>,
    avatar_url : Option<String>,
}

fn session_from_token_response(response: TokenResponse) -> AuthSession {
    let is_guest = response.user.is_anonymous;
    let username =
        response.user.user_metadata.full_name.or(response.user.user_metadata.name).or(response.user.user_metadata.user_name);

    AuthSession {
        access_token       : response.access_token,
        refresh_token      : response.refresh_token,
        expires_at         : chrono::Utc::now().timestamp() + response.expires_in,
        user_id            : response.user.id.clone(),
        discord_user_id    : (!is_guest).then(|| response.user.id),
        discord_username   : username,
        discord_avatar_url : response.user.user_metadata.avatar_url,
        is_guest,
    }
}

async fn post_auth(path_and_query: &str, body: serde_json::Value) -> Result<AuthSession, AppError> {
    let response = reqwest::Client::new()
        .post(format!("{SUPABASE_URL}{path_and_query}"))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {SUPABASE_ANON_KEY}"))
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Network(format!("couldn't reach sign-in ({e})")))?;

    if !response.status().is_success() {
        let status = response.status();
        let detail = response.text().await.unwrap_or_default();
        return Err(AppError::Network(format!("sign-in was rejected (status {status}): {detail}")));
    }

    let parsed: TokenResponse = response.json().await.map_err(|e| AppError::Network(format!("couldn't read the sign-in response ({e})")))?;
    Ok(session_from_token_response(parsed))
}

pub async fn exchange_pkce_code(auth_code: &str, code_verifier: &str) -> Result<AuthSession, AppError> {
    post_auth("/auth/v1/token?grant_type=pkce", serde_json::json!({ "auth_code": auth_code, "code_verifier": code_verifier })).await
}

pub async fn sign_in_as_guest() -> Result<AuthSession, AppError> {
    post_auth("/auth/v1/signup", serde_json::json!({ "data": {} })).await
}

pub async fn refresh_session(refresh_token: &str) -> Result<AuthSession, AppError> {
    post_auth("/auth/v1/token?grant_type=refresh_token", serde_json::json!({ "refresh_token": refresh_token })).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_a_verifier_and_matching_challenge() {
        let pkce = generate_pkce_challenge();
        assert_eq!(pkce.verifier.len(), 43);
        let expected_challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(pkce.verifier.as_bytes()));
        assert_eq!(pkce.challenge, expected_challenge);
    }

    #[test]
    fn two_challenges_are_never_the_same() {
        let a = generate_pkce_challenge();
        let b = generate_pkce_challenge();
        assert_ne!(a.verifier, b.verifier);
        assert_ne!(a.challenge, b.challenge);
    }

    #[test]
    fn parses_the_code_from_a_callback_url() {
        let url = "sysautomate://auth-callback?code=abc123&state=xyz";
        assert_eq!(parse_auth_code(url), Some("abc123".to_string()));
    }

    #[test]
    fn returns_none_when_no_code_is_present() {
        assert_eq!(parse_auth_code("sysautomate://auth-callback"), None);
    }
}
