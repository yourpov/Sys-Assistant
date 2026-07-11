use tauri::State;

use crate::application::tools_lookup;
use crate::dto::{AccountLookupDto, AccountLookupExtrasDto, LiveMatchSnapshotDto, MatchInfoDto, ValorantVersionStatusDto};
use crate::infrastructure::match_info::MatchFetchPhase;
use crate::invoke_error::{InvokeErrorDto, henrik_api_key_missing, invoke_err};
use crate::state::AppState;

#[tauri::command]
pub async fn lookup_account(state: State<'_, AppState>, name: String, tag: String) -> Result<AccountLookupDto, InvokeErrorDto> {
    let api_keys = require_api_keys(&state)?;
    tools_lookup::lookup_account(&api_keys, &name, &tag).await.map_err(invoke_err)
}

#[tauri::command]
pub async fn lookup_account_profile(state: State<'_, AppState>, name: String, tag: String) -> Result<AccountLookupDto, InvokeErrorDto> {
    let api_keys = require_api_keys(&state)?;
    tools_lookup::lookup_account_profile(&api_keys, &name, &tag).await.map_err(invoke_err)
}

#[tauri::command]
pub async fn lookup_account_extras(
    state: State<'_, AppState>,
    name  : String,
    tag   : String,
    region: String,
) -> Result<AccountLookupExtrasDto, InvokeErrorDto> {
    let api_keys = require_api_keys(&state)?;
    tools_lookup::lookup_account_extras(&api_keys, &name, &tag, &region).await.map_err(invoke_err)
}

#[tauri::command]
pub async fn fetch_match_info(state: State<'_, AppState>, phase: Option<String>) -> Result<MatchInfoDto, InvokeErrorDto> {
    let api_keys = require_api_keys(&state)?;
    tools_lookup::fetch_match_info(&api_keys, MatchFetchPhase::parse(phase.as_deref())).await.map_err(invoke_err)
}

#[tauri::command]
pub async fn detect_current_account(state: State<'_, AppState>) -> Result<AccountLookupDto, InvokeErrorDto> {
    let api_keys = require_api_keys(&state)?;
    tools_lookup::detect_current_account(&api_keys).await.map_err(invoke_err)
}

#[tauri::command]
pub async fn detect_current_account_profile(state: State<'_, AppState>) -> Result<AccountLookupDto, InvokeErrorDto> {
    let api_keys = require_api_keys(&state)?;
    tools_lookup::detect_current_account_profile(&api_keys).await.map_err(invoke_err)
}

#[tauri::command]
pub async fn fetch_live_match_snapshot() -> Result<LiveMatchSnapshotDto, InvokeErrorDto> {
    tools_lookup::fetch_live_match_snapshot().await.map_err(invoke_err)
}

#[tauri::command]
pub async fn fetch_valorant_version_status() -> Result<ValorantVersionStatusDto, InvokeErrorDto> {
    tools_lookup::fetch_valorant_version_status().await.map_err(invoke_err)
}

fn require_api_keys(state: &State<'_, AppState>) -> Result<Vec<String>, InvokeErrorDto> {
    let keys: Vec<String> = state
        .current_settings()
        .henrik_api_keys
        .into_iter()
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty())
        .collect();
    if keys.is_empty() {
        Err(henrik_api_key_missing())
    } else {
        Ok(keys)
    }
}