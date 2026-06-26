use std::time::Duration;

use super::ports::{LogLevel, Ports, ServiceState};
use super::run_workflow::StopToken;
use crate::domain::{CheckOutcome, IssueReport, Settings};
use crate::error::AppError;

const EMU_INSTALLER_EXE: &str = "emu_installer.exe";
const LOADER_EXE: &str = "ldr.novgk.exe";
const VANGUARD_CLIENT_SERVICE: &str = "vgc";
const VANGUARD_KERNEL_SERVICE: &str = "vgk";
const RIOT_RESTART_SETTLE: Duration = Duration::from_secs(2);

pub async fn check(ports: &Ports, settings: &Settings, stop: &StopToken) -> Result<CheckOutcome, AppError> {
    if !ports.machine.is_rdp_disabled()? {
        ports.sink.emit_line(LogLevel::Warn, "rdp is on. this breaks the emu, turning it off now");
        ports.machine.disable_rdp().await?;
        return Ok(CheckOutcome::NeedsReboot);
    }
    ports.sink.emit_line(LogLevel::Ok, "rdp is off");

    check_vanguard(ports).await?;
    ensure_vc_redist(ports, stop).await?;

    let core_isolation_enabled = ports.machine.is_core_isolation_enabled()?;
    if core_isolation_enabled {
        ports.sink.emit_line(LogLevel::Ok, "core isolation (memory integrity) is on");
    } else if ports.machine.is_windows_11() {
        ports.sink.emit_line(
            LogLevel::Warn,
            "core isolation (memory integrity) is off. vanguard needs this on windows 11. turn it on in windows security > device security, then restart",
        );
    } else {
        ports.sink.emit_line(
            LogLevel::Warn,
            "core isolation (memory integrity) is off. turn it on in windows security > device security if vanguard requires it, then restart",
        );
    }

    let riot_running = ports.riot.running_path().await.is_some();
    ports.sink.emit_line(
        if riot_running { LogLevel::Ok } else { LogLevel::Warn },
        if riot_running { "riot is running" } else { "riot is not running" },
    );

    let stay_signed_in = ports.riot.stay_signed_in_enabled().await;
    ports.sink.emit_line(
        if stay_signed_in { LogLevel::Ok } else { LogLevel::Warn },
        if stay_signed_in { "stay signed in is enabled" } else { "stay signed in is not enabled" },
    );

    let missing_files = find_missing_files(ports, settings);
    if missing_files.is_empty() {
        ports.sink.emit_line(LogLevel::Ok, "emu and loader found");
    }

    let report = IssueReport { riot_running, stay_signed_in, core_isolation_enabled, missing_files };
    let count = report.issue_count();
    if count == 0 {
        ports.sink.emit_line(LogLevel::Ok, "all good");
    } else {
        let noun = if count == 1 { "issue" } else { "issues" };
        ports.sink.emit_line(LogLevel::Warn, &format!("{count} {noun} found"));
    }
    Ok(CheckOutcome::Report(report))
}

pub async fn fix(report: &IssueReport, ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    if !report.riot_running {
        super::run_workflow::ensure_riot_running(ports, stop).await?;
    }
    if !report.stay_signed_in {
        ports.riot.enable_stay_signed_in().await?;
        ports.processes.kill_all(super::run_workflow::RIOT_CLIENT_PROCESS).await;
        super::run_workflow::sleep_cancellable(RIOT_RESTART_SETTLE, stop).await?;
        super::run_workflow::ensure_riot_running(ports, stop).await?;
        ports.sink.emit_line(LogLevel::Ok, "\"stay signed in\" is now enabled");
    }
    if !report.can_auto_fix() {
        let mut reasons: Vec<String> = report
            .missing_files
            .iter()
            .map(|f| format!("{f} wasn't found in the app folder or its subfolders. add it there, or set its path in Settings"))
            .collect();
        if !report.core_isolation_enabled {
            reasons.push(
                "Core isolation (Memory integrity) needs to be turned on manually in Windows Security > Device security, then your PC restarted"
                    .into(),
            );
        }
        return Err(AppError::Service(reasons.join(". also: ")));
    }
    ports.sink.emit_line(LogLevel::Ok, "all issues fixed");
    Ok(())
}

fn find_missing_files(ports: &Ports, settings: &Settings) -> Vec<String> {
    [(EMU_INSTALLER_EXE, settings.emu_path.as_deref()), (LOADER_EXE, settings.loader_path.as_deref())]
        .into_iter()
        .filter(|(filename, override_path)| ports.files.find(filename, *override_path).is_none())
        .map(|(filename, _)| filename.to_string())
        .collect()
}

async fn check_vanguard(ports: &Ports) -> Result<(), AppError> {
    ports.services.start(VANGUARD_CLIENT_SERVICE).await;
    ports.services.start(VANGUARD_KERNEL_SERVICE).await;

    let client = ports.services.query(VANGUARD_CLIENT_SERVICE).await;
    let kernel = ports.services.query(VANGUARD_KERNEL_SERVICE).await;

    if client == ServiceState::NotInstalled || kernel == ServiceState::NotInstalled {
        let missing = match (client == ServiceState::NotInstalled, kernel == ServiceState::NotInstalled) {
            (true, true) => "vgc and vgk (vanguard) aren't installed",
            (true, false) => "vgc (vanguard) isn't installed",
            (false, true) => "vgk (vanguard) isn't installed",
            (false, false) => unreachable!(),
        };
        return Err(AppError::Service(format!("{missing}. install or repair Riot Vanguard, then try again")));
    }

    if client == ServiceState::Running && kernel == ServiceState::Running {
        ports.sink.emit_line(LogLevel::Ok, "vgc/vgk are running");
    } else {
        ports.sink.emit_line(LogLevel::Warn, "vgc/vgk not running (normal if Vanguard On-Demand is enabled)");
    }
    Ok(())
}

async fn ensure_vc_redist(ports: &Ports, stop: &StopToken) -> Result<(), AppError> {
    if ports.machine.is_vc_redist_installed()? {
        ports.sink.emit_line(LogLevel::Ok, "vc redist is installed");
        return Ok(());
    }
    ports.sink.emit_line(LogLevel::Warn, "vc redist not installed. downloading it now");
    let destination = std::env::temp_dir().join("vc_redist.x64.exe");
    ports.downloader.download("https://aka.ms/vc14/vc_redist.x64.exe", &destination, ports.sink.as_ref()).await?;
    ports.launcher.launch(&destination, &["/install", "/quiet", "/norestart"]).await?;
    super::run_workflow::wait_for_tool_to_finish(ports, "vc_redist.x64.exe", stop).await?;
    ports.sink.emit_line(LogLevel::Ok, "vc redist is installed");
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::AtomicBool;
    use std::sync::{Arc, Mutex};

    use super::super::test_support::{fake_ports, FakeProcesses, FakeRiot, Recorder};
    use super::*;

    fn no_wait_settings() -> Settings {
        Settings { temp_val_wait: Duration::from_millis(1), sesh_wait: Duration::from_millis(1), ..Settings::default() }
    }

    #[tokio::test]
    async fn reports_riot_not_running_when_no_client_is_up() {
        let recorder = Arc::new(Recorder::default());
        let processes = Arc::new(FakeProcesses { running: Default::default() });
        let riot = Arc::new(FakeRiot { running: Mutex::new(false) });
        let ports = fake_ports(recorder, processes, riot);
        let stop = Arc::new(AtomicBool::new(false));

        let outcome = check(&ports, &no_wait_settings(), &stop).await.unwrap();

        match outcome {
            CheckOutcome::Report(report) => assert!(!report.riot_running),
            CheckOutcome::NeedsReboot => panic!("expected a report, not a reboot request"),
        }
    }

    #[tokio::test]
    async fn reports_no_issues_when_riot_is_already_running() {
        let recorder = Arc::new(Recorder::default());
        let processes = Arc::new(FakeProcesses { running: Default::default() });
        let riot = Arc::new(FakeRiot { running: Mutex::new(true) });
        let ports = fake_ports(recorder, processes, riot);
        let stop = Arc::new(AtomicBool::new(false));

        let outcome = check(&ports, &no_wait_settings(), &stop).await.unwrap();

        match outcome {
            CheckOutcome::Report(report) => assert_eq!(report.issue_count(), 0),
            CheckOutcome::NeedsReboot => panic!("expected a report, not a reboot request"),
        }
    }
}
