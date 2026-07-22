use tauri::State;

use crate::application::manual_actions;
use crate::application::ports::ServiceState;
use crate::commands::workflow::try_take_stop_token;
use crate::infrastructure::launcher;
use crate::invoke_error::{invoke_err, invoke_err_msg, InvokeErrorDto};
use crate::state::AppState;

const VANGUARD_FOLDER: &str = "Riot Vanguard";

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VanguardTracesDto {
    pub vgc_service   : bool,
    pub vgk_service   : bool,
    pub install_folder: bool,
    pub clean         : bool,
}

#[tauri::command]
pub async fn check_vanguard_traces(state: State<'_, AppState>) -> Result<VanguardTracesDto, InvokeErrorDto> {
    let (vgc, vgk) = tokio::join!(state.ports.services.query("vgc"), state.ports.services.query("vgk"));

    let vgc_service    = vgc != ServiceState::NotInstalled;
    let vgk_service    = vgk != ServiceState::NotInstalled;
    let install_folder = std::env::var("ProgramFiles")
        .map(|dir| std::path::Path::new(&dir).join(VANGUARD_FOLDER).exists())
        .unwrap_or(false);
    let clean = !vgc_service && !vgk_service && !install_folder;

    Ok(VanguardTracesDto { vgc_service, vgk_service, install_folder, clean })
}

#[tauri::command]
pub async fn uninstall_vanguard() -> Result<(), InvokeErrorDto> {
    let comspec = std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_string());
    let script = "/c sc stop vgc & sc stop vgk & \
                  sc delete vgc & sc delete vgk & \
                  rd /s /q \"%ProgramFiles%\\Riot Vanguard\"";

    launcher::run_elevated_command(&comspec, script).await.map_err(|e| {
        invoke_err_msg(
            "vanguard_uninstall_failed",
            "Vanguard couldn't be uninstalled",
            "Approve the Windows admin prompt when it appears, then try again. If you declined it, nothing was changed.",
            e.to_string(),
        )
    })
}

#[tauri::command]
pub async fn reinstall_vanguard(state: State<'_, AppState>) -> Result<(), InvokeErrorDto> {
    let guard    = try_take_stop_token(&state)?;
    let settings = state.current_settings();
    manual_actions::restart_riot_client(&settings, &state.ports, &guard.token)
        .await
        .map_err(invoke_err)
}
