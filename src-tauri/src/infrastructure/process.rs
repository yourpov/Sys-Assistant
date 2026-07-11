use std::sync::{LazyLock, Mutex};

use sysinfo::{ProcessesToUpdate, System};

use crate::application::ports::ProcessMonitor;

pub(crate) static PROCESS_TABLE: LazyLock<Mutex<System>> = LazyLock::new(|| Mutex::new(System::new()));

pub struct SysinfoProcessMonitor;

impl SysinfoProcessMonitor {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait::async_trait]
impl ProcessMonitor for SysinfoProcessMonitor {
    async fn is_running(&self, name: &str) -> bool {
        tokio::task::block_in_place(|| {
            let mut system = PROCESS_TABLE.lock().unwrap();
            system.refresh_processes(ProcessesToUpdate::All, true);
            system.processes().values().any(|process| matches_name(process, name))
        })
    }

    async fn kill_all(&self, name: &str) {
        tokio::task::block_in_place(|| {
            let mut system = PROCESS_TABLE.lock().unwrap();
            system.refresh_processes(ProcessesToUpdate::All, true);
            for process in system.processes().values().filter(|process| matches_name(process, name)) {
                process.kill();
            }
        })
    }
}

fn matches_name(process: &sysinfo::Process, name: &str) -> bool {
    process.name().to_string_lossy().to_lowercase().contains(&name.to_lowercase())
}
