use std::time::Duration;

use super::ports::{LogLevel, Ports, ServiceState};
use super::run_workflow::StopToken;
use crate::domain::{CheckOutcome, IssueReport, Settings};
use crate::error::AppError;

const EMU_INSTALLER_EXE: &str       = "emu_installer.exe";
const LOADER_EXE: &str              = "ldr.exe";
const VANGUARD_CLIENT_SERVICE: &str = "vgc";
const VANGUARD_KERNEL_SERVICE: &str = "vgk";
const RIOT_RESTART_SETTLE: Duration = Duration::from_secs(2);

pub async fn check(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<CheckOutcome, AppError> {
    super::run_workflow::check_cancelled(stop)?;
    if !ports.system_health.is_rdp_disabled()? {
        super::run_workflow::check_cancelled(stop)?;
        ports.sink.emit_line(LogLevel::Warn, "rdp is on. this breaks the emu, turning it off now");
        super::run_workflow::with_cancel(stop, ports.system_health.disable_rdp()).await?;
        super::run_workflow::check_cancelled(stop)?;
        return Ok(CheckOutcome::NeedsReboot);
    }
    super::run_workflow::emit_checked(ports, stop, LogLevel::Ok, "rdp is off")?;

    check_vanguard(ports, stop).await?;
    ensure_vc_redist(ports, stop).await?;
    super::run_workflow::check_cancelled(stop)?;

    super::run_workflow::check_cancelled(stop)?;
    if ports.system_health.is_core_isolation_enabled()? {
        super::run_workflow::emit_checked(
            ports,
            stop,
            LogLevel::Warn,
            "core isolation (memory integrity) is on. recommended off: windows security > device security > core isolation, then restart",
        )?;
    } else {
        super::run_workflow::emit_checked(ports, stop, LogLevel::Ok, "core isolation (memory integrity) is off")?;
    }

    super::run_workflow::check_cancelled(stop)?;
    if ports.system_health.is_vulnerable_driver_blocklist_enabled()? {
        super::run_workflow::emit_checked(
            ports,
            stop,
            LogLevel::Warn,
            "microsoft vulnerable driver blocklist is on. recommended off: windows security > device security > core isolation details, then restart",
        )?;
    } else {
        super::run_workflow::emit_checked(ports, stop, LogLevel::Ok, "microsoft vulnerable driver blocklist is off")?;
    }

    super::run_workflow::check_cancelled(stop)?;
    if ports.system_health.is_lsa_protection_enabled()? {
        super::run_workflow::emit_checked(
            ports,
            stop,
            LogLevel::Warn,
            "local security authority protection is on. suggested off: windows security > device security > core isolation details",
        )?;
    } else {
        super::run_workflow::emit_checked(ports, stop, LogLevel::Ok, "local security authority protection is off")?;
    }

    super::run_workflow::check_cancelled(stop)?;
    let (riot_running, stay_signed_in) = tokio::join!(
        async { ports.riot_runtime.running_path().await.is_some() },
        ports.riot_session.stay_signed_in_enabled(),
    );
    super::run_workflow::emit_checked(
        ports,
        stop,
        if riot_running { LogLevel::Ok } else { LogLevel::Warn },
        if riot_running { "riot is running" } else { "riot is not running" },
    )?;
    super::run_workflow::emit_checked(
        ports,
        stop,
        if stay_signed_in { LogLevel::Ok } else { LogLevel::Warn },
        if stay_signed_in { "stay signed in is enabled" } else { "stay signed in is not enabled" },
    )?;

    let missing_files = find_missing_files(ports, settings, stop)?;
    if missing_files.is_empty() {
        super::run_workflow::emit_checked(ports, stop, LogLevel::Ok, "emu and loader found")?;
    }

    super::run_workflow::check_cancelled(stop)?;
    let report = IssueReport { riot_running, stay_signed_in, missing_files };
    let count  = report.issue_count();
    if count == 0 {
        super::run_workflow::emit_checked(ports, stop, LogLevel::Ok, "all good")?;
    } else {
        let noun = if count == 1 { "issue" } else { "issues" };
        super::run_workflow::emit_checked(ports, stop, LogLevel::Warn, &format!("{count} {noun} found"))?;
    }
    Ok(CheckOutcome::Report(report))
}

pub async fn fix(report: &IssueReport, ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    super::run_workflow::check_cancelled(stop)?;
    if !report.riot_running {
        super::run_workflow::ensure_riot_running(ports, stop).await?;
    }
    if !report.stay_signed_in {
        super::run_workflow::check_cancelled(stop)?;
        super::run_workflow::with_cancel(stop, ports.riot_session.enable_stay_signed_in()).await?;
        super::run_workflow::check_cancelled(stop)?;
        ports.processes.kill_all(super::run_workflow::RIOT_CLIENT_PROCESS).await;
        super::run_workflow::check_cancelled(stop)?;
        super::run_workflow::sleep_cancellable(RIOT_RESTART_SETTLE, stop).await?;
        super::run_workflow::ensure_riot_running(ports, stop).await?;
        super::run_workflow::check_cancelled(stop)?;
        ports.sink.emit_line(LogLevel::Ok, "\"stay signed in\" is now enabled");
    }
    super::run_workflow::check_cancelled(stop)?;
    if !report.can_auto_fix() {
        let reasons: Vec<String> = report
            .missing_files
            .iter()
            .map(|f| format!("{f} wasn't found in the app folder or its subfolders. add it there, or set its path in Settings"))
            .collect();
        super::run_workflow::check_cancelled(stop)?;
        return Err(AppError::Service(reasons.join(". also: ")));
    }
    super::run_workflow::check_cancelled(stop)?;
    ports.sink.emit_line(LogLevel::Ok, "all issues fixed");
    Ok(())
}

fn find_missing_files(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<Vec<String>, AppError> {
    let mut missing = Vec::new();
    for (filename, override_path) in [(EMU_INSTALLER_EXE, settings.emu_path.as_deref()), (LOADER_EXE, settings.loader_path.as_deref())] {
        super::run_workflow::check_cancelled(stop)?;
        if ports.files.find(filename, override_path).is_none() {
            missing.push(filename.to_string());
        }
    }
    Ok(missing)
}

async fn check_vanguard(ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    super::run_workflow::check_cancelled(stop)?;
    super::run_workflow::with_cancel(stop, async {
        tokio::join!(
            ports.services.start(VANGUARD_CLIENT_SERVICE, &*ports.sink),
            ports.services.start(VANGUARD_KERNEL_SERVICE, &*ports.sink),
        );
        Ok(())
    })
    .await?;
    super::run_workflow::check_cancelled(stop)?;

    let (client, kernel) = tokio::join!(ports.services.query(VANGUARD_CLIENT_SERVICE), ports.services.query(VANGUARD_KERNEL_SERVICE));
    super::run_workflow::check_cancelled(stop)?;

    if client == ServiceState::NotInstalled || kernel == ServiceState::NotInstalled {
        let missing = match (client == ServiceState::NotInstalled, kernel == ServiceState::NotInstalled) {
            (true, true)   => "vgc and vgk (vanguard) aren't installed",
            (true, false)  => "vgc (vanguard) isn't installed",
            (false, true)  => "vgk (vanguard) isn't installed",
            (false, false) => unreachable!(),
        };
        return Err(AppError::Service(format!("{missing}. install or repair Riot Vanguard, then try again")));
    }

    if client == ServiceState::Running && kernel == ServiceState::Running {
        super::run_workflow::emit_checked(ports, stop, LogLevel::Ok, "vgc/vgk are both running")?;
        return Ok(());
    }

    let not_running = match (client == ServiceState::Running, kernel == ServiceState::Running) {
        (false, false) => "vgc and vgk (vanguard) aren't running",
        (false, true)  => "vgc (vanguard) isn't running",
        (true, false)  => "vgk (vanguard) isn't running",
        (true, true)   => unreachable!(),
    };
    Err(AppError::Service(format!(
        "{not_running}. both services must be running. start Riot Client / Vanguard, or reboot after installing, then try again"
    )))
}

async fn ensure_vc_redist(ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    super::run_workflow::check_cancelled(stop)?;
    if ports.system_health.is_vc_redist_installed()? {
        super::run_workflow::emit_checked(ports, stop, LogLevel::Ok, "vc redist is installed")?;
        return Ok(());
    }
    super::run_workflow::emit_checked(ports, stop, LogLevel::Warn, "vc redist not installed. downloading it now")?;
    let destination = std::env::temp_dir().join("vc_redist.x64.exe");
    super::run_workflow::with_cancel(
        stop,
        ports
            .downloader
            .download("https://aka.ms/vc14/vc_redist.x64.exe", &destination, ports.sink.as_ref()),
    )
    .await?;
    super::run_workflow::check_cancelled(stop)?;
    super::run_workflow::with_cancel(
        stop,
        ports.launcher.launch(&destination, &["/install", "/quiet", "/norestart"]),
    )
    .await?;
    super::run_workflow::wait_for_tool_to_finish(ports, "vc_redist.x64.exe", stop).await?;
    super::run_workflow::emit_checked(ports, stop, LogLevel::Ok, "vc redist is installed")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::AtomicBool;
    use std::sync::{Arc, Mutex};

    use super::super::test_support::{fake_ports, FakeProcesses, FakeRiot, Recorder};
    use super::*;

    fn no_wait_settings() -> Settings {
        Settings { ..Settings::default() }
    }

    #[test]
    fn find_missing_files_stops_when_cancelled() {
        let recorder  = Arc::new(Recorder::default());
        let processes = Arc::new(FakeProcesses { running: Default::default() });
        let riot      = Arc::new(FakeRiot { running: Mutex::new(false) });
        let ports     = fake_ports(recorder, processes, riot);
        let stop      = Arc::new(AtomicBool::new(true));

        let result = find_missing_files(&ports, &no_wait_settings(), &stop);

        assert!(matches!(result, Err(AppError::Cancelled)));
    }

    #[tokio::test]
    async fn cancelled_check_stops_before_any_work() {
        let recorder  = Arc::new(Recorder::default());
        let processes = Arc::new(FakeProcesses { running: Default::default() });
        let riot      = Arc::new(FakeRiot { running: Mutex::new(false) });
        let ports     = fake_ports(recorder, processes, riot);
        let stop      = Arc::new(AtomicBool::new(true));

        let result = check(&ports, &no_wait_settings(), &stop).await;

        assert!(matches!(result, Err(AppError::Cancelled)));
    }

    #[tokio::test]
    async fn reports_riot_not_running_when_no_client_is_up() {
        let recorder  = Arc::new(Recorder::default());
        let processes = Arc::new(FakeProcesses { running: Default::default() });
        let riot      = Arc::new(FakeRiot { running: Mutex::new(false) });
        let ports     = fake_ports(recorder, processes, riot);
        let stop      = Arc::new(AtomicBool::new(false));

        let outcome = check(&ports, &no_wait_settings(), &stop).await.unwrap();

        match outcome {
            CheckOutcome::Report(report) => assert!(!report.riot_running),
            CheckOutcome::NeedsReboot    => panic!("expected a report, not a reboot request"),
        }
    }

    #[tokio::test]
    async fn reports_no_issues_when_riot_is_already_running() {
        let recorder  = Arc::new(Recorder::default());
        let processes = Arc::new(FakeProcesses { running: Default::default() });
        let riot      = Arc::new(FakeRiot { running: Mutex::new(true) });
        let ports     = fake_ports(recorder, processes, riot);
        let stop      = Arc::new(AtomicBool::new(false));

        let outcome = check(&ports, &no_wait_settings(), &stop).await.unwrap();

        match outcome {
            CheckOutcome::Report(report) => assert_eq!(report.issue_count(), 0),
            CheckOutcome::NeedsReboot    => panic!("expected a report, not a reboot request"),
        }
    }
}
