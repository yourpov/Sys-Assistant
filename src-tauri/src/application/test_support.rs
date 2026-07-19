#![cfg(test)]

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use super::ports::*;
use crate::domain::Account;
use crate::error::AppError;

#[derive(Default)]
pub struct Recorder {
    pub launched : Mutex<Vec<PathBuf>>,
    pub killed   : Mutex<Vec<String>>,
}

struct FakeSink;
impl EventSink for FakeSink {
    fn emit_line(&self, _level: LogLevel, _message: &str) {}
}

pub struct FakeProcesses {
    pub running: Mutex<Vec<String>>,
}

#[async_trait::async_trait]
impl ProcessMonitor for FakeProcesses {
    async fn is_running(&self, name: &str) -> bool {
        self.running.lock().unwrap().iter().any(|p| p == name)
    }

    async fn kill_all(&self, name: &str) {
        let _ = name;
    }
}

struct FakeLauncher(Arc<Recorder>);
#[async_trait::async_trait]
impl ProcessLauncher for FakeLauncher {
    async fn launch(&self, path: &Path, _args: &[&str]) -> Result<(), AppError> {
        self.0.launched.lock().unwrap().push(path.to_path_buf());
        Ok(())
    }

    async fn launch_elevated(&self, path: &Path) -> Result<(), AppError> {
        self.0.launched.lock().unwrap().push(path.to_path_buf());
        Ok(())
    }

    async fn launch_silent_and_confirm(&self, path: &Path, _sink: &dyn EventSink) -> Result<(), AppError> {
        self.0.launched.lock().unwrap().push(path.to_path_buf());
        Ok(())
    }
}

struct FakeKillTrackingProcesses {
    inner    : Arc<FakeProcesses>,
    recorder : Arc<Recorder>,
}
#[async_trait::async_trait]
impl ProcessMonitor for FakeKillTrackingProcesses {
    async fn is_running(&self, name: &str) -> bool {
        self.inner.is_running(name).await
    }
    async fn kill_all(&self, name: &str) {
        self.recorder.killed.lock().unwrap().push(name.to_string());
    }
}

struct FakeFiles;
impl FileFinder for FakeFiles {
    fn find(&self, filename: &str, _override_path: Option<&Path>) -> Option<PathBuf> {
        Some(PathBuf::from(filename))
    }
}

struct FakeMachine;
#[async_trait::async_trait]
impl SystemHealth for FakeMachine {
    fn is_rdp_disabled(&self) -> Result<bool, AppError> {
        Ok(true)
    }
    async fn disable_rdp(&self) -> Result<(), AppError> {
        Ok(())
    }
    fn is_vc_redist_installed(&self) -> Result<bool, AppError> {
        Ok(true)
    }
    fn is_core_isolation_enabled(&self) -> Result<bool, AppError> {
        Ok(false)
    }
    fn is_vulnerable_driver_blocklist_enabled(&self) -> Result<bool, AppError> {
        Ok(false)
    }
    fn is_lsa_protection_enabled(&self) -> Result<bool, AppError> {
        Ok(false)
    }
}

#[async_trait::async_trait]
impl EmuEnvironment for FakeMachine {
    fn current_emu_seed(&self) -> Option<String> {
        None
    }
    async fn set_emu_seed(&self, _seed: u32) -> Result<(), AppError> {
        Ok(())
    }
    async fn flush_dns(&self) -> Result<(), AppError> {
        Ok(())
    }
}

struct FakeServices;
#[async_trait::async_trait]
impl ServiceControl for FakeServices {
    async fn start(&self, _service: &str, _sink: &dyn EventSink) {}
    async fn query(&self, _service: &str) -> ServiceState {
        ServiceState::Running
    }
}

pub struct FakeRiot {
    pub running: Mutex<bool>,
}
#[async_trait::async_trait]
impl RiotRuntime for FakeRiot {
    async fn running_path(&self) -> Option<PathBuf> {
        self.running.lock().unwrap().then(|| PathBuf::from("RiotClientServices.exe"))
    }
    async fn running_pid(&self) -> Option<u32> {
        self.running.lock().unwrap().then_some(1234)
    }
    async fn install_path(&self) -> Option<PathBuf> {
        Some(PathBuf::from("RiotClientServices.exe"))
    }
    async fn launch_client(&self, _path: &Path) -> Result<(), AppError> {
        *self.running.lock().unwrap() = true;
        Ok(())
    }
}

#[async_trait::async_trait]
impl RiotLauncher for FakeRiot {
    async fn launch_valorant_direct(&self, _riot_path: &Path) -> Result<(), AppError> {
        Ok(())
    }
    async fn launch_valorant_via_api(&self) -> Result<(), AppError> {
        Ok(())
    }
}

#[async_trait::async_trait]
impl RiotSession for FakeRiot {
    async fn is_logged_in(&self) -> bool {
        *self.running.lock().unwrap()
    }
    fn invalidate_login_cache(&self) {}
    async fn stay_signed_in_enabled(&self) -> bool {
        true
    }
    async fn enable_stay_signed_in(&self) -> Result<(), AppError> {
        Ok(())
    }
}

struct FakeDownloader;
#[async_trait::async_trait]
impl Downloader for FakeDownloader {
    async fn download(&self, _url: &str, _destination: &Path, _sink: &dyn EventSink) -> Result<(), AppError> {
        Ok(())
    }
}

struct FakePrompt;
#[async_trait::async_trait]
impl UserPrompt for FakePrompt {
    async fn pick_riot_client_exe(&self) -> Option<PathBuf> {
        None
    }
}

struct FakeKeySimulator;
impl KeySimulator for FakeKeySimulator {
    fn press_insert(&self) -> Result<(), AppError> {
        Ok(())
    }

    fn press_key(&self, _key: &str) -> Result<(), AppError> {
        Ok(())
    }
}

pub struct FakeAccountStore {
    pub accounts  : Mutex<Vec<Account>>,
    pub passwords : Mutex<std::collections::HashMap<String, String>>,
}

impl AccountStore for FakeAccountStore {
    fn list(&self) -> Vec<Account> {
        self.accounts.lock().unwrap().clone()
    }
    fn add(&self, label: String, username: String, _password: String) -> Result<Account, AppError> {
        Ok(Account { id: "fake".into(), label, username, notes: None, full_access: true, category: None, region: None })
    }
    fn update(&self, _id: &str, _label: String, _username: String, _password: Option<String>) -> Result<(), AppError> {
        Ok(())
    }
    fn remove(&self, _id: &str) -> Result<(), AppError> {
        Ok(())
    }
    fn password(&self, id: &str) -> Result<String, AppError> {
        self.passwords.lock().unwrap().get(id).cloned().ok_or_else(|| AppError::Account("no password".into()))
    }
    fn set_notes(&self, _id: &str, _notes: Option<String>) -> Result<(), AppError> {
        Ok(())
    }
    fn set_full_access(&self, _id: &str, _full_access: bool) -> Result<(), AppError> {
        Ok(())
    }
    fn set_category(&self, _id: &str, _category: Option<String>) -> Result<(), AppError> {
        Ok(())
    }
    fn set_region(&self, _id: &str, _region: Option<String>) -> Result<(), AppError> {
        Ok(())
    }
    fn reorder(&self, ids: &[String]) -> Result<(), AppError> {
        let mut accounts = self.accounts.lock().unwrap();
        let mut by_id: std::collections::HashMap<String, Account> = accounts
            .iter()
            .map(|account| (account.id.clone(), account.clone()))
            .collect();
        let mut reordered = Vec::with_capacity(accounts.len());
        for id in ids {
            if let Some(account) = by_id.remove(id) {
                reordered.push(account);
            }
        }
        for account in accounts.iter() {
            if by_id.contains_key(&account.id) {
                reordered.push(account.clone());
            }
        }
        *accounts = reordered;
        Ok(())
    }
}

pub struct FakeRiotLogin {
    pub calls: Mutex<Vec<(u32, String, String)>>,
}

impl RiotLogin for FakeRiotLogin {
    fn login(
        &self,
        pid: u32,
        username: &str,
        password: &str,
        _sink: &dyn EventSink,
        _stop: &std::sync::atomic::AtomicBool,
    ) -> Result<(), AppError> {
        self.calls.lock().unwrap().push((pid, username.to_string(), password.to_string()));
        Ok(())
    }
}

#[derive(Default)]
pub struct FakeSessionSnapshotStore {
    pub has_snapshot : Mutex<bool>,
    pub restored     : Mutex<bool>,
    pub cleared      : Mutex<bool>,
    pub saved        : Mutex<bool>,
    pub forgotten    : Mutex<bool>,
}

impl SessionSnapshotStore for FakeSessionSnapshotStore {
    fn has_snapshot(&self, _account_id: &str) -> bool {
        *self.has_snapshot.lock().unwrap()
    }
    fn save(&self, _account_id: &str, _install_dir: Option<&Path>, _sink: &dyn EventSink) -> Result<(), AppError> {
        *self.saved.lock().unwrap() = true;
        Ok(())
    }
    fn restore(&self, _account_id: &str, _install_dir: Option<&Path>, _sink: &dyn EventSink) -> Result<(), AppError> {
        *self.restored.lock().unwrap() = true;
        Ok(())
    }
    fn clear_active_session(&self) -> Result<(), AppError> {
        *self.cleared.lock().unwrap() = true;
        Ok(())
    }
    fn forget(&self, _account_id: &str) -> Result<(), AppError> {
        *self.forgotten.lock().unwrap() = true;
        Ok(())
    }
}

pub fn fake_ports(recorder: Arc<Recorder>, processes: Arc<FakeProcesses>, riot: Arc<FakeRiot>) -> Ports {
    let machine = Arc::new(FakeMachine);
    Ports {
        processes     : Arc::new(FakeKillTrackingProcesses { inner: processes, recorder: recorder.clone() }),
        launcher      : Arc::new(FakeLauncher(recorder)),
        files         : Arc::new(FakeFiles),
        system_health : machine.clone(),
        emu_env       : machine,
        services      : Arc::new(FakeServices),
        riot_runtime  : riot.clone(),
        riot_launch   : riot.clone(),
        riot_session  : riot,
        downloader    : Arc::new(FakeDownloader),
        prompt        : Arc::new(FakePrompt),
        sink          : Arc::new(FakeSink),
        keys          : Arc::new(FakeKeySimulator),
    }
}
