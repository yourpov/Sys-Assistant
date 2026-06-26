use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use super::ports::{LogLevel, Ports};
use crate::domain::{Settings, WorkflowAction};
use crate::error::AppError;

pub type StopToken = Arc<AtomicBool>;

pub(super) const RIOT_CLIENT_PROCESS: &str = "RiotClientServices";
pub(super) const VALORANT_PROCESS: &str = "VALORANT";
pub(super) const SESH_EXE: &str = "sesh.exe";
pub(super) const LOADER_EXE: &str = "ldr.novgk.exe";
pub(super) const EMU_INSTALLER_EXE: &str = "emu_installer.exe";

const RIOT_CLIENT_POLL_INTERVAL: Duration = Duration::from_secs(2);
const RIOT_CLIENT_STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
const RIOT_SETTLE_POLL_INTERVAL: Duration = Duration::from_secs(1);
const RIOT_SETTLE_DURATION: Duration = Duration::from_secs(5);
const VALORANT_QUICK_CHECK_INTERVAL: Duration = Duration::from_secs(1);
const VALORANT_QUICK_CHECK_TIMEOUT: Duration = Duration::from_secs(5);
const TOOL_POLL_INTERVAL: Duration = Duration::from_secs(2);

pub async fn run(action: WorkflowAction, settings: &Settings, ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    match action {
        WorkflowAction::StartWithRestart => start(ports, settings, stop, true).await,
        WorkflowAction::StartWithoutRestart => start(ports, settings, stop, false).await,
        WorkflowAction::Fix55Error => fix_55_error(ports, settings, stop).await,
        WorkflowAction::CloseAll => close_all(ports).await,
    }
}

async fn start(ports: &Ports, settings: &Settings, stop: &StopToken, should_restart_valorant: bool) -> Result<(), AppError> {
    find_required(ports, LOADER_EXE, settings.loader_path.as_deref())?;
    ensure_sesh(ports, settings, stop).await?;
    ensure_riot_running_with_emu_refresh(ports, settings, stop).await?;
    if should_restart_valorant {
        temp_open_valorant(ports, settings, stop).await?;
    } else {
        close_valorant_if_running(ports, settings, stop).await?;
    }
    change_seed(ports).await?;
    run_loader(ports, settings).await?;
    open_valorant(ports, settings, stop).await?;
    start_session(ports, settings, stop, true).await
}

async fn fix_55_error(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    close_valorant_if_running(ports, settings, stop).await?;

    ports.processes.kill_all(RIOT_CLIENT_PROCESS).await;
    ports.sink.emit_line(LogLevel::Info, "riot client closed");
    sleep_cancellable(settings.close_wait, stop).await?;
    ensure_riot_running_with_emu_refresh(ports, settings, stop).await?;

    ports.machine.flush_dns().await?;
    ports.sink.emit_line(LogLevel::Ok, "dns cache flushed");

    run_loader(ports, settings).await?;
    open_valorant(ports, settings, stop).await?;
    start_session(ports, settings, stop, true).await
}

pub(super) async fn ensure_riot_running(ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    if ports.riot.running_path().await.is_some() {
        return Ok(());
    }
    let install_path = match ports.riot.install_path().await {
        Some(path) => path,
        None => ports
            .prompt
            .pick_riot_client_exe()
            .await
            .ok_or_else(|| AppError::RiotClient("riot client wasn't found, and no path was chosen. run this again and pick RiotClientServices.exe when asked".into()))?,
    };
    ports.riot.launch_client(&install_path).await?;
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
        if ports.riot.running_path().await.is_some() {
            stable_for += RIOT_SETTLE_POLL_INTERVAL;
        } else {
            stable_for = Duration::ZERO;
            ensure_riot_running(ports, stop).await?;
        }
    }
    Ok(())
}

async fn ensure_riot_running_with_emu_refresh(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    let was_already_running = ports.riot.running_path().await.is_some();
    ensure_riot_running(ports, stop).await?;
    if !was_already_running {
        wait_for_riot_to_settle(ports, stop).await?;
        run_emu_installer(ports, settings, stop).await?;
    }
    Ok(())
}

pub(super) async fn change_seed(ports: &Ports) -> Result<(), AppError> {
    let previous = ports.machine.current_emu_seed().unwrap_or_else(|| "none".to_string());
    let next: u32 = rand::random();
    ports.machine.set_emu_seed(next).await?;
    ports.sink.emit_line(LogLevel::Ok, &format!("changed emu seed: {previous} -> {next}"));
    Ok(())
}

async fn temp_open_valorant(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    start_valorant(ports, stop).await?;
    wait_for_valorant(ports, settings, stop).await?;
    sleep_cancellable(settings.temp_val_wait, stop).await?;
    ports.sink.emit_line(LogLevel::Info, "closing val");
    ports.processes.kill_all(VALORANT_PROCESS).await;
    sleep_cancellable(settings.close_wait, stop).await
}

pub(super) async fn close_valorant_if_running(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    if !ports.processes.is_running(VALORANT_PROCESS).await {
        return Ok(());
    }
    ports.sink.emit_line(LogLevel::Info, "closing val");
    ports.processes.kill_all(VALORANT_PROCESS).await;
    sleep_cancellable(settings.close_wait, stop).await
}

pub(super) async fn run_loader(ports: &Ports, settings: &Settings) -> Result<(), AppError> {
    let path = find_required(ports, LOADER_EXE, settings.loader_path.as_deref())?;
    ports.launcher.launch(&path, &[]).await?;
    ports.sink.emit_line(LogLevel::Ok, "loader running");
    Ok(())
}

pub(super) async fn run_emu_installer(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    let path = find_required(ports, EMU_INSTALLER_EXE, settings.emu_path.as_deref())?;
    ports.launcher.launch(&path, &[]).await?;
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

pub(super) async fn ensure_sesh(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<std::path::PathBuf, AppError> {
    if let Some(path) = ports.files.find(SESH_EXE, settings.sesh_path.as_deref()) {
        return Ok(path);
    }
    let Some(installer) = ports.files.find(EMU_INSTALLER_EXE, settings.emu_path.as_deref()) else {
        return Err(AppError::Service(format!(
            "{SESH_EXE} hasn't been created yet, and {EMU_INSTALLER_EXE} (which creates it) wasn't found either. \
add {EMU_INSTALLER_EXE} to the app folder or set its path in Settings, then try again"
        )));
    };
    ports.sink.emit_line(LogLevel::Warn, &format!("{SESH_EXE} not found, running {EMU_INSTALLER_EXE} to create it"));
    ports.launcher.launch(&installer, &[]).await?;
    wait_for_tool_to_finish(ports, EMU_INSTALLER_EXE, stop).await?;
    ports.sink.emit_line(LogLevel::Ok, "emu installer finished");
    ports.files.find(SESH_EXE, settings.sesh_path.as_deref()).ok_or_else(|| {
        AppError::Service(format!("ran {EMU_INSTALLER_EXE} but {SESH_EXE} still wasn't created. make sure the installer finished successfully, then try again"))
    })
}

pub(super) async fn open_valorant(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    start_valorant(ports, stop).await?;
    wait_for_valorant(ports, settings, stop).await
}

async fn start_valorant(ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    let riot_path = ports
        .riot
        .running_path()
        .await
        .ok_or_else(|| AppError::RiotClient("riot client isn't running anymore. try running this again".into()))?;
    ports.riot.launch_valorant_direct(&riot_path).await?;
    if wait_for_process(ports, VALORANT_PROCESS, VALORANT_QUICK_CHECK_INTERVAL, Some(VALORANT_QUICK_CHECK_TIMEOUT), stop).await? {
        return Ok(());
    }
    ports.sink.emit_line(LogLevel::Warn, "direct launch didn't work, trying the riot api instead");
    ports.riot.launch_valorant_via_api().await
}

async fn wait_for_valorant(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<(), AppError> {
    if wait_for_process(ports, VALORANT_PROCESS, settings.check_every, Some(settings.val_launch_timeout), stop).await? {
        ports.sink.emit_line(LogLevel::Ok, "val found");
        return Ok(());
    }
    ports.sink.emit_line(LogLevel::Warn, "val didn't open in time, trying again");
    start_valorant(ports, stop).await?;
    wait_for_process(ports, VALORANT_PROCESS, settings.check_every, None, stop).await?;
    ports.sink.emit_line(LogLevel::Ok, "val found");
    Ok(())
}

pub(super) async fn start_session(ports: &Ports, settings: &Settings, stop: &StopToken, wait_to_settle: bool) -> Result<(), AppError> {
    let path = ensure_sesh(ports, settings, stop).await?;
    if wait_to_settle {
        sleep_cancellable(settings.sesh_wait, stop).await?;
    } else if stop.load(Ordering::Relaxed) {
        return Err(AppError::Cancelled);
    }
    if ports.processes.is_running(SESH_EXE).await {
        ports.sink.emit_line(LogLevel::Warn, "a session is already running, replacing it");
        ports.processes.kill_all(SESH_EXE).await;
        sleep_cancellable(settings.close_wait, stop).await?;
    }
    ports.launcher.launch(&path, &[]).await?;
    ports.sink.emit_line(LogLevel::Ok, "ready");
    Ok(())
}

async fn close_all(ports: &Ports) -> Result<(), AppError> {
    ports.processes.kill_all(VALORANT_PROCESS).await;
    ports.processes.kill_all(RIOT_CLIENT_PROCESS).await;
    ports.processes.kill_all(SESH_EXE).await;
    ports.processes.kill_all(LOADER_EXE).await;
    ports.sink.emit_line(LogLevel::Ok, "closed");
    Ok(())
}

async fn wait_for_process(ports: &Ports, name: &str, every: Duration, timeout: Option<Duration>, stop: &StopToken) -> Result<bool, AppError> {
    let started = Instant::now();
    loop {
        if stop.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }
        if ports.processes.is_running(name).await {
            return Ok(true);
        }
        if let Some(limit) = timeout {
            if started.elapsed() >= limit {
                return Ok(false);
            }
        }
        tokio::time::sleep(every).await;
    }
}

pub(super) async fn wait_for_process_gone(ports: &Ports, name: &str, every: Duration, timeout: Duration, stop: &StopToken) -> Result<(), AppError> {
    let started = Instant::now();
    loop {
        if stop.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }
        if !ports.processes.is_running(name).await {
            return Ok(());
        }
        if started.elapsed() >= timeout {
            return Ok(());
        }
        tokio::time::sleep(every).await;
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
            temp_val_wait: Duration::from_millis(1),
            sesh_wait: Duration::from_millis(1),
            check_every: Duration::from_millis(1),
            close_wait: Duration::from_millis(1),
            val_launch_timeout: Duration::from_millis(50),
            ..Settings::default()
        }
    }

    #[tokio::test]
    async fn create_session_launches_sesh_immediately() {
        let recorder = Arc::new(Recorder::default());
        let processes = Arc::new(FakeProcesses { running: Default::default() });
        let riot = Arc::new(FakeRiot { running: std::sync::Mutex::new(false) });
        let ports = fake_ports(recorder.clone(), processes, riot);
        let stop = Arc::new(AtomicBool::new(false));

        start_session(&ports, &no_wait_settings(), &stop, false).await.unwrap();

        let launched = recorder.launched.lock().unwrap();
        assert!(launched.iter().any(|p| p.ends_with(SESH_EXE)));
    }

    #[tokio::test]
    async fn create_session_replaces_an_already_running_session() {
        let recorder = Arc::new(Recorder::default());
        let processes = Arc::new(FakeProcesses { running: std::sync::Mutex::new(vec![SESH_EXE.to_string()]) });
        let riot = Arc::new(FakeRiot { running: std::sync::Mutex::new(false) });
        let ports = fake_ports(recorder.clone(), processes, riot);
        let stop = Arc::new(AtomicBool::new(false));

        start_session(&ports, &no_wait_settings(), &stop, false).await.unwrap();

        let killed = recorder.killed.lock().unwrap();
        assert!(killed.iter().any(|p| p == SESH_EXE));
        let launched = recorder.launched.lock().unwrap();
        assert!(launched.iter().any(|p| p.ends_with(SESH_EXE)));
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
        assert!(killed.iter().any(|p| p == SESH_EXE));
        assert!(killed.iter().any(|p| p == LOADER_EXE));
    }

    #[tokio::test]
    async fn cancelling_before_a_wait_stops_the_workflow() {
        let recorder = Arc::new(Recorder::default());
        let processes = Arc::new(FakeProcesses { running: Default::default() });
        let riot = Arc::new(FakeRiot { running: std::sync::Mutex::new(false) });
        let ports = fake_ports(recorder, processes, riot);
        let stop = Arc::new(AtomicBool::new(true));

        let result = start_session(&ports, &no_wait_settings(), &stop, false).await;

        assert!(matches!(result, Err(AppError::Cancelled)));
    }
}
