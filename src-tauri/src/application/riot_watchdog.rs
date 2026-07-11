use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

use super::ports::{LogLevel, Ports};
use super::run_workflow::{EMU_INSTALLER_EXE, LOGIN_WAIT_TIMEOUT};
use crate::domain::Settings;
use crate::error::AppError;
use crate::state::{AppState, RiotWatchdogPause};

const POLL_INTERVAL: Duration = Duration::from_secs(3);

fn should_skip_emu_on_launch(pause: &RiotWatchdogPause, manual_run_active: bool) -> bool {
    if manual_run_active || pause.suppressed {
        return true;
    }
    pause.ignore_edges_until.is_some_and(|until| Instant::now() < until)
}

pub struct AccountRiotFlowGuard<'a> {
    state: &'a AppState,
}

impl<'a> AccountRiotFlowGuard<'a> {
    pub fn new(state: &'a AppState) -> Self {
        state.begin_account_riot_flow();
        Self { state }
    }
}

impl Drop for AccountRiotFlowGuard<'_> {
    fn drop(&mut self) {
        self.state.end_account_riot_flow();
    }
}

pub async fn run(app: AppHandle) {
    let mut was_running = riot_is_running(&app).await;

    loop {
        tokio::time::sleep(POLL_INTERVAL).await;

        let state    = app.state::<AppState>();
        let settings = state.current_settings();
        if !settings.install_emu_on_riot_launch_enabled {
            continue;
        }

        let ports             = state.ports.clone();
        let is_running        = ports.riot_runtime.running_path().await.is_some();
        let manual_run_active = crate::infrastructure::sync_lock::lock_or_recover(&state.active_stop).is_some();
        let pause             = state.riot_watchdog_pause_snapshot();

        if !is_running && was_running {
            ports.riot_session.invalidate_login_cache();
            ports.sink.emit_line(LogLevel::Warn, "riot client closed");
        }

        if should_skip_emu_on_launch(&pause, manual_run_active) {
            was_running = is_running;
            continue;
        }

        if is_running && !was_running {
            let app = app.clone();
            tokio::spawn(async move {
                handle_riot_launched(&app).await;
            });
        }

        was_running = is_running;
    }
}

async fn riot_is_running(app: &AppHandle) -> bool {
    app.state::<AppState>().ports.riot_runtime.running_path().await.is_some()
}

async fn handle_riot_launched(app: &AppHandle) {
    let state    = app.state::<AppState>();
    let settings = state.current_settings();
    let ports    = state.ports.clone();
    let mut missing_file_warned = false;

    if !ports.riot_session.is_logged_in().await {
        ports.sink.emit_line(LogLevel::Info, "riot client launched, waiting for you to log in before installing the emu");
        if !wait_until_logged_in(&state, &ports).await {
            return;
        }
    }

    if ports.riot_runtime.running_path().await.is_none() {
        return;
    }
    if crate::infrastructure::sync_lock::lock_or_recover(&state.active_stop).is_some() {
        return;
    }

    ports.sink.emit_line(LogLevel::Info, "installing emu to avoid the 55% bug");
    match install_emu(&ports, &settings).await {
        InstallOutcome::Installed => {
            ports.sink.emit_line(LogLevel::Ok, "emu installed");
        }
        InstallOutcome::LaunchFailed(e) => {
            ports.sink.emit_line(LogLevel::Error, &format!("riot watchdog couldn't run {EMU_INSTALLER_EXE} ({e})"));
        }
        InstallOutcome::FileMissing => warn_file_missing_once(&ports, &mut missing_file_warned),
    }
}

async fn wait_until_logged_in(state: &AppState, ports: &Ports) -> bool {
    let mut waited = Duration::ZERO;
    while !ports.riot_session.is_logged_in().await && waited < LOGIN_WAIT_TIMEOUT {
        if crate::infrastructure::sync_lock::lock_or_recover(&state.active_stop).is_some() {
            return false;
        }
        if ports.riot_runtime.running_path().await.is_none() {
            return false;
        }
        tokio::time::sleep(POLL_INTERVAL).await;
        waited += POLL_INTERVAL;
    }
    ports.riot_session.is_logged_in().await
}

enum InstallOutcome {
    Installed,
    LaunchFailed(AppError),
    FileMissing,
}

async fn install_emu(ports: &Ports, settings: &Settings) -> InstallOutcome {
    let Some(path) = ports.files.find(EMU_INSTALLER_EXE, settings.emu_path.as_deref()) else {
        return InstallOutcome::FileMissing;
    };
    match ports.launcher.launch_silent_and_confirm(&path, ports.sink.as_ref()).await {
        Ok(()) => InstallOutcome::Installed,
        Err(e) => InstallOutcome::LaunchFailed(e),
    }
}

fn warn_file_missing_once(ports: &Ports, missing_file_warned: &mut bool) {
    if *missing_file_warned {
        return;
    }
    ports.sink.emit_line(
        LogLevel::Warn,
        &format!("riot watchdog: {EMU_INSTALLER_EXE} not found, can't fix 55% error without it. set its path in settings"),
    );
    *missing_file_warned = true;
}