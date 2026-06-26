use tauri::State;

use crate::dto::{AccountLookupDto, MatchInfoDto};
use crate::infrastructure::{henrik, match_info};
use crate::state::AppState;

const NO_API_KEY: &str = "add a henrikdev api key in settings to use lookups. get one free at api.henrikdev.xyz/dashboard, then try again";

#[tauri::command]
pub async fn lookup_account(state: State<'_, AppState>, name: String, tag: String) -> Result<AccountLookupDto, String> {
    let api_keys = require_api_keys(&state)?;
    henrik::fetch_account_lookup(&api_keys, &name, &tag).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_match_info(state: State<'_, AppState>) -> Result<MatchInfoDto, String> {
    let api_keys = require_api_keys(&state)?;
    match_info::fetch_live_match(&api_keys).await.map_err(|e| e.to_string())
}

fn require_api_keys(state: &State<'_, AppState>) -> Result<Vec<String>, String> {
    let keys: Vec<String> = state.current_settings().henrik_api_keys.into_iter().map(|k| k.trim().to_string()).filter(|k| !k.is_empty()).collect();
    if keys.is_empty() { Err(NO_API_KEY.to_string()) } else { Ok(keys) }
}
