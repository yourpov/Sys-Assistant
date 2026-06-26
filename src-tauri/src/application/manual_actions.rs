use super::ports::{LogLevel, Ports};
use super::run_workflow::{self, StopToken, RIOT_CLIENT_PROCESS, VALORANT_PROCESS};
use crate::domain::{ManualAction, Settings};
use crate::error::AppError;

pub async fn run(action: ManualAction, settings: &Settings, ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    match action {
        ManualAction::ToggleValorant => toggle_valorant(ports, settings, stop).await,
        ManualAction::ToggleRiotClient => toggle_riot_client(ports, stop).await,
        ManualAction::OpenLoader => run_workflow::run_loader(ports, settings).await,
        ManualAction::ChangeSeed => run_workflow::change_seed(ports).await,
        ManualAction::OpenEmuInstaller => open_emu_installer(ports, settings).await,
        ManualAction::RestartValorant => restart_valorant(ports, settings, stop).await,
        ManualAction::CreateSession => run_workflow::start_session(ports, settings, stop, false).await,
    }
}

async fn toggle_valorant(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    if ports.processes.is_running(VALORANT_PROCESS).await {
        close(ports, VALORANT_PROCESS, "val").await
    } else {
        run_workflow::ensure_riot_running(ports, stop).await?;
        run_workflow::open_valorant(ports, settings, stop).await
    }
}

async fn toggle_riot_client(ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    if ports.processes.is_running(RIOT_CLIENT_PROCESS).await {
        close(ports, RIOT_CLIENT_PROCESS, "riot client").await
    } else {
        run_workflow::ensure_riot_running(ports, stop).await
    }
}

async fn close(ports: &Ports, process_name: &str, label: &str) -> Result<(), AppError> {
    ports.processes.kill_all(process_name).await;
    ports.sink.emit_line(LogLevel::Ok, &format!("{label} closed"));
    Ok(())
}

async fn open_emu_installer(ports: &Ports, settings: &Settings) -> Result<(), AppError> {
    let path = run_workflow::find_required(ports, run_workflow::EMU_INSTALLER_EXE, settings.emu_path.as_deref())?;
    ports.launcher.launch(&path, &[]).await?;
    ports.sink.emit_line(LogLevel::Ok, "emu installer running");
    Ok(())
}

async fn restart_valorant(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    if ports.processes.is_running(VALORANT_PROCESS).await {
        close(ports, VALORANT_PROCESS, "val").await?;
        run_workflow::sleep_cancellable(settings.close_wait, stop).await?;
    }
    run_workflow::ensure_riot_running(ports, stop).await?;
    run_workflow::open_valorant(ports, settings, stop).await
}
