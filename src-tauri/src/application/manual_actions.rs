use std::time::Duration;

use super::ports::{LogLevel, Ports};
use super::run_workflow::{self, StopToken, RIOT_CLIENT_PROCESS, VALORANT_PROCESS};
use crate::domain::{ManualAction, Settings};
use crate::error::AppError;

const RIOT_CLOSE_POLL_INTERVAL: Duration = Duration::from_millis(500);
const RIOT_CLOSE_TIMEOUT: Duration       = Duration::from_secs(6);

pub async fn restart_riot_client(settings: &Settings, ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    run_workflow::check_cancelled(stop)?;
    ports.processes.kill_all(VALORANT_PROCESS).await;
    ports.processes.kill_all(RIOT_CLIENT_PROCESS).await;
    run_workflow::wait_for_process_gone(ports, RIOT_CLIENT_PROCESS, RIOT_CLOSE_POLL_INTERVAL, RIOT_CLOSE_TIMEOUT, stop).await?;
    run_workflow::sleep_cancellable(settings.close_wait, stop).await?;
    ports.sink.emit_line(LogLevel::Info, "reopening riot client for the vanguard install prompt");
    run_workflow::ensure_riot_running(ports, stop).await
}

pub async fn run(action: ManualAction, settings: &Settings, ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    match action {
        ManualAction::ToggleValorant   => toggle_valorant(ports, settings, stop).await,
        ManualAction::ToggleRiotClient => toggle_riot_client(ports, stop).await,
        ManualAction::OpenLoader       => run_workflow::run_loader(ports, settings, stop).await,
        ManualAction::ChangeSeed       => run_workflow::change_seed(ports, stop).await,
        ManualAction::OpenEmuInstaller => open_emu_installer(ports, settings, stop).await,
        ManualAction::OpenTraceX       => open_tracex(ports, settings, stop).await,
        ManualAction::RestartValorant  => restart_valorant(ports, settings, stop).await,
    }
}

async fn toggle_valorant(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    if ports.processes.is_running(VALORANT_PROCESS).await {
        close(ports, VALORANT_PROCESS, "val", stop).await
    } else {
        run_workflow::ensure_riot_running(ports, stop).await?;
        run_workflow::open_valorant(ports, settings, stop).await
    }
}

async fn toggle_riot_client(ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    if ports.processes.is_running(RIOT_CLIENT_PROCESS).await {
        close(ports, RIOT_CLIENT_PROCESS, "riot client", stop).await
    } else {
        run_workflow::ensure_riot_running(ports, stop).await
    }
}

async fn close(ports: &Ports, process_name: &str, label: &str, stop: &StopToken) -> Result<(), AppError> {
    run_workflow::check_cancelled(stop)?;
    ports.processes.kill_all(process_name).await;
    ports.sink.emit_line(LogLevel::Ok, &format!("{label} closed"));
    Ok(())
}

async fn open_emu_installer(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    run_workflow::check_cancelled(stop)?;
    let path = run_workflow::find_required(ports, run_workflow::EMU_INSTALLER_EXE, settings.emu_path.as_deref())?;
    run_workflow::relaunch(ports, &path, true, &[], stop).await?;
    ports.sink.emit_line(LogLevel::Ok, "emu installer running");
    Ok(())
}

async fn open_tracex(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    run_workflow::check_cancelled(stop)?;
    let path = run_workflow::find_tracex(ports, settings)
        .ok_or_else(|| AppError::FileMissing(run_workflow::tracex_exe_name(settings).to_string()))?;
    run_workflow::relaunch(ports, &path, true, &[], stop).await?;
    ports.sink.emit_line(LogLevel::Ok, "tracex running");
    Ok(())
}

async fn restart_valorant(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    if ports.processes.is_running(VALORANT_PROCESS).await {
        close(ports, VALORANT_PROCESS, "val", stop).await?;
        run_workflow::sleep_cancellable(settings.close_wait, stop).await?;
    }
    run_workflow::ensure_riot_running(ports, stop).await?;
    run_workflow::open_valorant(ports, settings, stop).await
}
