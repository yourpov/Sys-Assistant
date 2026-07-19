use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use super::ports::{LogLevel, Ports};
use crate::domain::{Settings, WorkflowAction};
use crate::error::{AppError, RiotClientError};

pub type StopToken = Arc<AtomicBool>;

pub(super) const RIOT_CLIENT_PROCESS: &str = "RiotClientServices";
pub(super) const VALORANT_PROCESS: &str = "VALORANT";
pub(super) const LOADER_EXE: &str = "ldr.exe";
pub(super) const EMU_INSTALLER_EXE: &str = "emu_installer.exe";

const RIOT_CLIENT_POLL_INTERVAL: Duration     = Duration::from_secs(2);
const RIOT_CLIENT_STARTUP_TIMEOUT: Duration   = Duration::from_secs(30);
const RIOT_SETTLE_POLL_INTERVAL: Duration     = Duration::from_secs(1);
const RIOT_SETTLE_DURATION: Duration          = Duration::from_secs(5);
const VALORANT_QUICK_CHECK_INTERVAL: Duration = Duration::from_secs(1);
const VALORANT_QUICK_CHECK_TIMEOUT: Duration  = Duration::from_secs(5);
const TOOL_POLL_INTERVAL: Duration            = Duration::from_secs(2);
pub(super) const LOGIN_POLL_INTERVAL: Duration = Duration::from_secs(2);
pub(super) const LOGIN_WAIT_TIMEOUT: Duration = Duration::from_secs(300);

pub async fn run(action: WorkflowAction, settings: &Settings, ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    match action {
        WorkflowAction::Start => start(ports, settings, stop).await,
        WorkflowAction::CloseAll => close_all(ports, stop).await,
    }
}

pub(super) fn check_cancelled(stop: &StopToken) -> Result<(), AppError> {
    if stop.load(Ordering::Acquire) {
        Err(AppError::Cancelled)
    } else {
        Ok(())
    }
}

pub(super) fn emit_checked(ports: &Ports, stop: &StopToken, level: LogLevel, message: &str) -> Result<(), AppError> {
    check_cancelled(stop)?;
    ports.sink.emit_line(level, message);
    Ok(())
}

async fn wait_for_cancel(stop: &StopToken) {
    while !stop.load(Ordering::Acquire) {
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

pub(super) async fn with_cancel<T, F>(stop: &StopToken, fut: F) -> Result<T, AppError>
where
    F: std::future::Future<Output = Result<T, AppError>>,
{
    tokio::select! {
        result = fut => result,
        () = wait_for_cancel(stop) => Err(AppError::Cancelled),
    }
}

async fn start(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    find_required(ports, LOADER_EXE, settings.loader_path.as_deref())?;
    find_required(ports, EMU_INSTALLER_EXE, settings.emu_path.as_deref())?;

    if settings.auto_fix_55_enabled {
        force_refresh_riot_client(ports, settings, stop).await?;
    } else {
        ensure_riot_running(ports, stop).await?;
        close_valorant_if_running(ports, settings, stop).await?;
        run_emu_installer(ports, settings, stop).await?;
    }

    run_loader(ports, settings, stop).await?;
    open_valorant(ports, settings, stop).await?;
    ports.sink.emit_line(LogLevel::Ok, "ready");
    Ok(())
}

pub(super) async fn run_post_login_start_process(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    find_required(ports, LOADER_EXE, settings.loader_path.as_deref())?;
    find_required(ports, EMU_INSTALLER_EXE, settings.emu_path.as_deref())?;

    if settings.auto_fix_55_enabled {
        apply_55_fix(ports, settings, stop).await?;
    } else {
        run_emu_installer(ports, settings, stop).await?;
    }

    run_loader(ports, settings, stop).await?;
    open_valorant(ports, settings, stop).await?;
    Ok(())
}

async fn force_refresh_riot_client(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    close_valorant_if_running(ports, settings, stop).await?;

    check_cancelled(stop)?;
    ports.processes.kill_all(RIOT_CLIENT_PROCESS).await;
    check_cancelled(stop)?;
    ports.sink.emit_line(LogLevel::Info, "riot client closed");
    sleep_cancellable(settings.close_wait, stop).await?;
    ensure_riot_running(ports, stop).await?;
    wait_for_riot_to_settle(ports, stop).await?;

    apply_55_fix(ports, settings, stop).await
}

pub(super) async fn apply_55_fix(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    if !ports.riot_session.is_logged_in().await {
        ports.sink.emit_line(LogLevel::Info, "waiting for you to log in to the riot client");
        if !wait_for_riot_login(ports, stop).await? {
            ports.sink.emit_line(LogLevel::Warn, "still not logged in, running the emu installer anyway");
        }
    }

    run_emu_installer_silently(ports, settings, stop).await?;

    check_cancelled(stop)?;
    ports.emu_env.flush_dns().await?;
    check_cancelled(stop)?;
    ports.sink.emit_line(LogLevel::Ok, "dns cache flushed");
    Ok(())
}

pub(super) async fn wait_for_riot_login(ports: &Ports, stop: &StopToken) -> Result<bool, AppError> {
    let started = Instant::now();
    while !ports.riot_session.is_logged_in().await {
        if started.elapsed() >= LOGIN_WAIT_TIMEOUT {
            return Ok(false);
        }
        sleep_cancellable(LOGIN_POLL_INTERVAL, stop).await?;
    }
    Ok(true)
}

pub(super) async fn run_emu_installer_silently(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    check_cancelled(stop)?;
    let path = find_required(ports, EMU_INSTALLER_EXE, settings.emu_path.as_deref())?;
    ports.sink.emit_line(LogLevel::Info, "running emu installer");
    with_cancel(stop, ports.launcher.launch_silent_and_confirm(&path, ports.sink.as_ref())).await?;
    check_cancelled(stop)?;
    ports.sink.emit_line(LogLevel::Ok, "emu installer finished");
    Ok(())
}

pub(super) async fn ensure_riot_running(ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    if ports.riot_runtime.running_path().await.is_some() {
        return Ok(());
    }
    let install_path = match ports.riot_runtime.install_path().await {
        Some(path) => path,
        None => {
            let picked = ports.prompt.pick_riot_client_exe().await;
            check_cancelled(stop)?;
            picked.ok_or_else(|| AppError::RiotClient("riot client wasn't found, and no path was chosen. run this again and pick RiotClientServices.exe when asked".into()))?
        }
    };
    check_cancelled(stop)?;
    with_cancel(stop, ports.riot_runtime.launch_client(&install_path)).await?;
    if !wait_for_process(ports, RIOT_CLIENT_PROCESS, RIOT_CLIENT_POLL_INTERVAL, Some(RIOT_CLIENT_STARTUP_TIMEOUT), stop).await? {
        return Err(AppError::RiotClient("riot client didn't start. try running this again".into()));
    }
    ports.sink.emit_line(LogLevel::Ok, "riot is running");
    Ok(())
}

pub(super) async fn wait_for_riot_to_settle(ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    let mut stable_for = Duration::ZERO;
    while stable_for < RIOT_SETTLE_DURATION {
        sleep_cancellable(RIOT_SETTLE_POLL_INTERVAL, stop).await?;
        if ports.riot_runtime.running_path().await.is_some() {
            stable_for += RIOT_SETTLE_POLL_INTERVAL;
        } else {
            stable_for = Duration::ZERO;
            ensure_riot_running(ports, stop).await?;
        }
    }
    Ok(())
}

pub(super) async fn change_seed(ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    check_cancelled(stop)?;
    let previous = ports.emu_env.current_emu_seed().unwrap_or_else(|| "none".to_string());
    let next: u32 = rand::random();
    ports.emu_env.set_emu_seed(next).await?;
    check_cancelled(stop)?;
    ports.sink.emit_line(LogLevel::Ok, &format!("changed emu seed: {previous} -> {next}"));
    Ok(())
}

pub(super) async fn close_valorant_if_running(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    if !ports.processes.is_running(VALORANT_PROCESS).await {
        return Ok(());
    }
    ports.sink.emit_line(LogLevel::Info, "closing val");
    ports.processes.kill_all(VALORANT_PROCESS).await;
    sleep_cancellable(settings.close_wait, stop).await
}

pub(super) async fn run_loader(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    check_cancelled(stop)?;
    let path = find_required(ports, LOADER_EXE, settings.loader_path.as_deref())?;
    with_cancel(stop, ports.launcher.launch(&path, &[])).await?;
    check_cancelled(stop)?;
    ports.sink.emit_line(LogLevel::Ok, "loader running");
    Ok(())
}

pub(super) async fn run_emu_installer(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    check_cancelled(stop)?;
    let path = find_required(ports, EMU_INSTALLER_EXE, settings.emu_path.as_deref())?;
    with_cancel(stop, ports.launcher.launch_elevated(&path)).await?;
    check_cancelled(stop)?;
    ports.sink.emit_line(LogLevel::Info, "press enter on the emu installer to continue");
    wait_for_tool_to_finish(ports, EMU_INSTALLER_EXE, stop).await?;
    ports.sink.emit_line(LogLevel::Ok, "emu installer finished");
    Ok(())
}

pub(super) async fn wait_for_tool_to_finish(ports: &Ports, process_name: &str, stop: &StopToken) -> Result<(), AppError> {
    sleep_cancellable(TOOL_POLL_INTERVAL, stop).await?;
    while ports.processes.is_running(process_name).await {
        sleep_cancellable(TOOL_POLL_INTERVAL, stop).await?;
    }
    Ok(())
}

pub(super) fn find_required(ports: &Ports, filename: &str, override_path: Option<&std::path::Path>) -> Result<std::path::PathBuf, AppError> {
    ports.files.find(filename, override_path).ok_or_else(|| AppError::FileMissing(filename.to_string()))
}

pub(super) async fn open_valorant(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    start_valorant(ports, stop).await?;
    wait_for_valorant(ports, settings, stop).await
}

async fn start_valorant(ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    check_cancelled(stop)?;
    let riot_path = ports
        .riot_runtime
        .running_path()
        .await
        .ok_or(AppError::RiotClient(RiotClientError::NotRunning))?;
    with_cancel(stop, ports.riot_launch.launch_valorant_direct(&riot_path)).await?;
    if wait_for_process(ports, VALORANT_PROCESS, VALORANT_QUICK_CHECK_INTERVAL, Some(VALORANT_QUICK_CHECK_TIMEOUT), stop).await? {
        return Ok(());
    }
    check_cancelled(stop)?;
    ports.sink.emit_line(LogLevel::Warn, "direct launch didn't work, trying the riot api instead");
    with_cancel(stop, ports.riot_launch.launch_valorant_via_api()).await?;
    check_cancelled(stop)?;
    Ok(())
}

async fn wait_for_valorant(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    if wait_for_process(ports, VALORANT_PROCESS, settings.check_every, Some(settings.val_launch_timeout), stop).await? {
        ports.sink.emit_line(LogLevel::Ok, "val found");
        return Ok(());
    }
    ports.sink.emit_line(LogLevel::Warn, "val didn't open in time, trying again");
    start_valorant(ports, stop).await?;
    if !wait_for_process(ports, VALORANT_PROCESS, settings.check_every, None, stop).await? {
        return Err(AppError::RiotClient("valorant didn't open after retry".into()));
    }
    ports.sink.emit_line(LogLevel::Ok, "val found");
    Ok(())
}

async fn close_all(ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    check_cancelled(stop)?;
    ports.processes.kill_all(VALORANT_PROCESS).await;
    check_cancelled(stop)?;
    ports.processes.kill_all(RIOT_CLIENT_PROCESS).await;
    check_cancelled(stop)?;
    ports.processes.kill_all(LOADER_EXE).await;
    ports.sink.emit_line(LogLevel::Ok, "closed");
    Ok(())
}

async fn wait_for_process(ports: &Ports, name: &str, every: Duration, timeout: Option<Duration>, stop: &StopToken) -> Result<bool, AppError> {
    let started = Instant::now();
    loop {
        check_cancelled(stop)?;
        if ports.processes.is_running(name).await {
            return Ok(true);
        }
        if let Some(limit) = timeout {
            if started.elapsed() >= limit {
                return Ok(false);
            }
        }
        sleep_cancellable(every, stop).await?;
    }
}

pub(super) async fn wait_for_process_gone(ports: &Ports, name: &str, every: Duration, timeout: Duration, stop: &StopToken) -> Result<(), AppError> {
    let started = Instant::now();
    loop {
        check_cancelled(stop)?;
        if !ports.processes.is_running(name).await {
            return Ok(());
        }
        if started.elapsed() >= timeout {
            return Ok(());
        }
        sleep_cancellable(every, stop).await?;
    }
}

pub(super) async fn sleep_cancellable(duration: Duration, stop: &StopToken) -> Result<(), AppError> {
    if stop.load(Ordering::Relaxed) {
        return Err(AppError::Cancelled);
    }
    let deadline = Instant::now() + duration;
    let step = Duration::from_millis(200).min(duration.max(Duration::from_millis(1)));
    while Instant::now() < deadline {
        tokio::time::sleep(step).await;
        if stop.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{fake_ports, FakeProcesses, FakeRiot, Recorder};
    use super::*;

    fn no_wait_settings() -> Settings {
        Settings {
            check_every        : Duration::from_millis(1),
            close_wait         : Duration::from_millis(1),
            val_launch_timeout : Duration::from_millis(50),
            ..Settings::default()
        }
    }

    #[tokio::test]
    async fn close_all_kills_every_tracked_process() {
        let recorder = Arc::new(Recorder::default());
        let processes = Arc::new(FakeProcesses { running: Default::default() });
        let riot = Arc::new(FakeRiot { running: std::sync::Mutex::new(false) });
        let ports = fake_ports(recorder.clone(), processes, riot);
        let stop = Arc::new(AtomicBool::new(false));

        run(WorkflowAction::CloseAll, &no_wait_settings(), &ports, &stop).await.unwrap();

        let killed = recorder.killed.lock().unwrap();
        assert!(killed.iter().any(|p| p == VALORANT_PROCESS));
        assert!(killed.iter().any(|p| p == RIOT_CLIENT_PROCESS));
        assert!(killed.iter().any(|p| p == LOADER_EXE));
    }

    #[tokio::test]
    async fn cancelling_before_a_wait_stops_the_workflow() {
        let recorder = Arc::new(Recorder::default());
        let processes = Arc::new(FakeProcesses { running: Default::default() });
        let riot = Arc::new(FakeRiot { running: std::sync::Mutex::new(false) });
        let ports = fake_ports(recorder, processes, riot);
        let stop = Arc::new(AtomicBool::new(true));

        let result = sleep_cancellable(Duration::from_secs(10), &stop).await;

        assert!(matches!(result, Err(AppError::Cancelled)));
    }
}
