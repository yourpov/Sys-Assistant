use tauri::State;

use crate::dto::SavedPlayerDto;
use crate::invoke_error::{InvokeErrorDto, invoke_err_msg};
use crate::state::AppState;

#[tauri::command]
pub fn list_saved_players(state: State<'_, AppState>) -> Result<Vec<SavedPlayerDto>, InvokeErrorDto> {
    Ok(state.saved_players.list())
}

#[tauri::command]
pub fn add_saved_player(
    state: State<'_, AppState>,
    name          : String,
    tag           : String,
    rank          : Option<String>,
    rr            : Option<i64>,
    rank_icon_url : Option<String>,
    agent         : Option<String>,
    agent_icon_url: Option<String>,
) -> Result<SavedPlayerDto, InvokeErrorDto> {
    state
        .saved_players
        .upsert(name, tag, rank, rr, rank_icon_url, agent, agent_icon_url)
        .map_err(|e| invoke_err_msg(
            "saved_player_failed",
            "That player couldn't be saved",
            "Try again. If it keeps failing, open Developer logs in Settings, About, Developer.",
            e.to_string(),
        ))
}

#[tauri::command]
pub fn remove_saved_player(state: State<'_, AppState>, id: String) -> Result<(), InvokeErrorDto> {
    state.saved_players.remove(&id).map_err(|e| invoke_err_msg(
        "saved_player_remove_failed",
        "That saved player couldn't be removed",
        "Refresh the list and try again.",
        e.to_string(),
    ))
}