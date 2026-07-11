use std::os::windows::process::CommandExt;
use std::process::{Command, Output};

use crate::application::ports::{EventSink, LogLevel, ServiceControl, ServiceState};

const CREATE_NO_WINDOW: u32        = 0x0800_0000;
const SERVICE_DOES_NOT_EXIST: i32  = 1060;
const SERVICE_ALREADY_RUNNING: i32 = 1056;

fn sc_command() -> Command {
    let mut command = Command::new("sc");
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

pub struct ScServiceControl;

#[async_trait::async_trait]
impl ServiceControl for ScServiceControl {
    async fn start(&self, service: &str, sink: &dyn EventSink) {
        let service_name = service.to_string();
        let result = tokio::task::spawn_blocking(move || sc_command().args(["start", &service_name]).output()).await;
        match result {
            Ok(Ok(output)) if output.status.code() == Some(SERVICE_ALREADY_RUNNING) => {}
            Ok(Ok(output)) if !output.status.success() => {
                sink.emit_line(LogLevel::Warn, &format!("couldn't start service '{service}': {}", String::from_utf8_lossy(&output.stdout).trim()));
            }
            Ok(Err(e)) => sink.emit_line(LogLevel::Warn, &format!("couldn't start service '{service}': {e}")),
            Err(e) => sink.emit_line(LogLevel::Warn, &format!("couldn't start service '{service}': {e}")),
            Ok(Ok(_)) => {}
        }
    }

    async fn query(&self, service: &str) -> ServiceState {
        let service = service.to_string();
        tokio::task::spawn_blocking(move || {
            sc_command()
                .args(["query", &service])
                .output()
                .map(|output| service_state(&output))
                .unwrap_or(ServiceState::NotInstalled)
        })
        .await
        .unwrap_or(ServiceState::NotInstalled)
    }
}

fn service_state(output: &Output) -> ServiceState {
    if output.status.code() == Some(SERVICE_DOES_NOT_EXIST) {
        return ServiceState::NotInstalled;
    }
    if is_running_state(&String::from_utf8_lossy(&output.stdout)) {
        ServiceState::Running
    } else {
        ServiceState::Stopped
    }
}

fn is_running_state(output: &str) -> bool {
    output
        .lines()
        .find(|line| line.trim_start().starts_with("STATE"))
        .and_then(|line| line.split(':').nth(1))
        .and_then(|rest| rest.split_whitespace().next())
        .is_some_and(|code| code == "4")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_running_state_regardless_of_locale() {
        let english = "SERVICE_NAME: vgc\n        TYPE               : 10  WIN32_OWN_PROCESS\n        STATE              : 4  RUNNING\n";
        let french = "SERVICE_NAME: vgc\n        TYPE               : 10  WIN32_OWN_PROCESS\n        STATE              : 4  EN_COURS_D'EXECUTION\n";
        assert!(is_running_state(english));
        assert!(is_running_state(french));
    }

    #[test]
    fn does_not_match_a_stopped_service() {
        let stopped = "SERVICE_NAME: vgc\n        TYPE               : 10  WIN32_OWN_PROCESS\n        STATE              : 1  STOPPED\n";
        assert!(!is_running_state(stopped));
    }
}
