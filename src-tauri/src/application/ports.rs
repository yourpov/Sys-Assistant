use std::path::{Path, PathBuf};

use crate::domain::Account;
use crate::error::AppError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Ok,
    Warn,
    Error,
    Info,
}

pub trait EventSink: Send + Sync {
    fn emit_line(&self, level: LogLevel, message: &str);

    fn emit_progress(&self, message: &str) {
        self.emit_line(LogLevel::Info, message);
    }
}

#[async_trait::async_trait]
pub trait ProcessMonitor: Send + Sync {
    async fn is_running(&self, name: &str) -> bool;
    async fn kill_all(&self, name: &str);
}

#[async_trait::async_trait]
pub trait ProcessLauncher: Send + Sync {
    async fn launch(&self, path: &Path, args: &[&str]) -> Result<(), AppError>;
    async fn launch_elevated(&self, path: &Path) -> Result<(), AppError>;
    async fn launch_silent_and_confirm(&self, path: &Path, sink: &dyn EventSink) -> Result<(), AppError>;
}

pub trait FileFinder: Send + Sync {
    fn find(&self, filename: &str, override_path: Option<&Path>) -> Option<PathBuf>;
}

#[async_trait::async_trait]
pub trait SystemHealth: Send + Sync {
    fn is_rdp_disabled(&self) -> Result<bool, AppError>;
    async fn disable_rdp(&self) -> Result<(), AppError>;
    fn is_vc_redist_installed(&self) -> Result<bool, AppError>;
    fn is_core_isolation_enabled(&self) -> Result<bool, AppError>;
    fn is_windows_11(&self) -> bool;
}

#[async_trait::async_trait]
pub trait EmuEnvironment: Send + Sync {
    fn current_emu_seed(&self) -> Option<String>;
    async fn set_emu_seed(&self, seed: u32) -> Result<(), AppError>;
    async fn flush_dns(&self) -> Result<(), AppError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServiceState {
    Running,
    Stopped,
    NotInstalled,
}

#[async_trait::async_trait]
pub trait ServiceControl: Send + Sync {
    async fn start(&self, service: &str, sink: &dyn EventSink);
    async fn query(&self, service: &str) -> ServiceState;
}

#[async_trait::async_trait]
pub trait RiotRuntime: Send + Sync {
    async fn running_path(&self) -> Option<PathBuf>;
    async fn running_pid(&self) -> Option<u32>;
    async fn install_path(&self) -> Option<PathBuf>;
    async fn launch_client(&self, path: &Path) -> Result<(), AppError>;
}

#[async_trait::async_trait]
pub trait RiotLauncher: Send + Sync {
    async fn launch_valorant_direct(&self, riot_path: &Path) -> Result<(), AppError>;
    async fn launch_valorant_via_api(&self) -> Result<(), AppError>;
}

#[async_trait::async_trait]
pub trait RiotSession: Send + Sync {
    async fn is_logged_in(&self) -> bool;
    fn invalidate_login_cache(&self);
    async fn stay_signed_in_enabled(&self) -> bool;
    async fn enable_stay_signed_in(&self) -> Result<(), AppError>;
}

#[async_trait::async_trait]
pub trait Downloader: Send + Sync {
    async fn download(&self, url: &str, destination: &Path, sink: &dyn EventSink) -> Result<(), AppError>;
}

#[async_trait::async_trait]
pub trait UserPrompt: Send + Sync {
    async fn pick_riot_client_exe(&self) -> Option<PathBuf>;
}

pub trait AccountStore: Send + Sync {
    fn list(&self) -> Vec<Account>;
    fn add(&self, label: String, username: String, password: String) -> Result<Account, AppError>;
    fn update(&self, id: &str, label: String, username: String, password: Option<String>) -> Result<(), AppError>;
    fn remove(&self, id: &str) -> Result<(), AppError>;
    fn password(&self, id: &str) -> Result<String, AppError>;
    fn set_notes(&self, id: &str, notes: Option<String>) -> Result<(), AppError>;
    fn set_full_access(&self, id: &str, full_access: bool) -> Result<(), AppError>;
    fn reorder(&self, ids: &[String]) -> Result<(), AppError>;
}

pub trait RiotLogin: Send + Sync {
    fn login(
        &self,
        pid: u32,
        username: &str,
        password: &str,
        sink: &dyn EventSink,
        stop: &std::sync::atomic::AtomicBool,
    ) -> Result<(), AppError>;
}

pub trait SessionSnapshotStore: Send + Sync {
    fn has_snapshot(&self, account_id: &str) -> bool;
    fn save(&self, account_id: &str, install_dir: Option<&Path>, sink: &dyn EventSink) -> Result<(), AppError>;
    fn restore(&self, account_id: &str, install_dir: Option<&Path>, sink: &dyn EventSink) -> Result<(), AppError>;
    fn clear_active_session(&self) -> Result<(), AppError>;
    fn forget(&self, account_id: &str) -> Result<(), AppError>;
}

pub trait KeySimulator: Send + Sync {
    fn press_insert(&self) -> Result<(), AppError>;
    fn press_key(&self, key: &str) -> Result<(), AppError>;
}

#[derive(Clone)]
pub struct Ports {
    pub processes     : std::sync::Arc<dyn ProcessMonitor>,
    pub launcher      : std::sync::Arc<dyn ProcessLauncher>,
    pub files         : std::sync::Arc<dyn FileFinder>,
    pub system_health : std::sync::Arc<dyn SystemHealth>,
    pub emu_env       : std::sync::Arc<dyn EmuEnvironment>,
    pub services      : std::sync::Arc<dyn ServiceControl>,
    pub riot_runtime  : std::sync::Arc<dyn RiotRuntime>,
    pub riot_launch   : std::sync::Arc<dyn RiotLauncher>,
    pub riot_session  : std::sync::Arc<dyn RiotSession>,
    pub downloader    : std::sync::Arc<dyn Downloader>,
    pub prompt        : std::sync::Arc<dyn UserPrompt>,
    pub sink          : std::sync::Arc<dyn EventSink>,
    pub keys          : std::sync::Arc<dyn KeySimulator>,
}