use crate::error::AppError;
use crate::infrastructure::discord_auth::{self, AuthSession};
use crate::infrastructure::sync_lock::lock_or_recover;
use crate::state::AppState;

const REFRESH_MARGIN_SECS: i64 = 60;

pub fn start_sign_in(state: &AppState) -> String {
    let pkce = discord_auth::generate_pkce_challenge();
    let url = discord_auth::build_authorize_url(&pkce.challenge);
    *lock_or_recover(&state.pending_pkce_verifier) = Some(pkce.verifier);
    url
}

pub async fn sign_in_as_guest(state: &AppState) -> Result<AuthSession, AppError> {
    let session = discord_auth::sign_in_as_guest().await?;
    state.auth_store.save(&session)?;
    *lock_or_recover(&state.auth_session) = Some(session.clone());
    Ok(session)
}

pub async fn handle_callback(state: &AppState, callback_url: &str) -> Result<AuthSession, AppError> {
    let code = discord_auth::parse_auth_code(callback_url)
        .ok_or_else(|| AppError::Network("discord sign-in didn't return a code. try signing in again".into()))?;
    let verifier = lock_or_recover(&state.pending_pkce_verifier)
        .take()
        .ok_or_else(|| AppError::Network("no sign-in was in progress. click \"sign in with discord\" first".into()))?;

    let session = discord_auth::exchange_pkce_code(&code, &verifier).await?;
    state.auth_store.save(&session)?;
    *lock_or_recover(&state.auth_session) = Some(session.clone());
    Ok(session)
}

pub fn sign_out(state: &AppState) -> Result<(), AppError> {
    state.auth_store.clear()?;
    *lock_or_recover(&state.auth_session) = None;
    *lock_or_recover(&state.pending_pkce_verifier) = None;
    Ok(())
}

pub fn current_session(state: &AppState) -> Option<AuthSession> {
    lock_or_recover(&state.auth_session).clone()
}

pub async fn access_token(state: &AppState) -> Result<Option<String>, AppError> {
    let Some(session) = current_session(state) else { return Ok(None) };
    if chrono::Utc::now().timestamp() < session.expires_at - REFRESH_MARGIN_SECS {
        return Ok(Some(session.access_token));
    }

    let _refresh_guard = state.auth_refresh_lock.lock().await;

    let Some(session) = current_session(state) else { return Ok(None) };
    if chrono::Utc::now().timestamp() < session.expires_at - REFRESH_MARGIN_SECS {
        return Ok(Some(session.access_token));
    }

    let refreshed = discord_auth::refresh_session(&session.refresh_token).await?;
    state.auth_store.save(&refreshed)?;
    let token = refreshed.access_token.clone();
    *lock_or_recover(&state.auth_session) = Some(refreshed);
    Ok(Some(token))
}