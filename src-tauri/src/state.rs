use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager};

use crate::application::ports::{AccountStore, Ports, RiotLogin, SessionSnapshotStore};
use crate::application::run_workflow::StopToken;
use crate::domain::Settings;
use crate::error::AppError;
use crate::infrastructure::settings_store::SettingsStore;
use crate::infrastructure::{
    account_store, downloader, events, files, key_simulator, launcher, process, prompt, registry, riot_client, riot_login, services, session_snapshot,
};

pub struct AppState {
    pub ports: Ports,
    pub accounts: Arc<dyn AccountStore>,
    pub riot_login: Arc<dyn RiotLogin>,
    pub sessions: Arc<dyn SessionSnapshotStore>,
    pub active_stop: Mutex<Option<StopToken>>,
    pub settings: Mutex<Settings>,
    pub registered_shortcut: Mutex<Option<String>>,
    pub account_swap_last_used: Mutex<Option<String>>,
    settings_store: SettingsStore,
}

impl AppState {
    pub fn new(app: &AppHandle) -> Self {
        let app_dir = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
            .unwrap_or_default();
        let ports = Ports {
            processes: Arc::new(process::SysinfoProcessMonitor::new()),
            launcher: Arc::new(launcher::WindowsLauncher),
            files: Arc::new(files::AppDirFileFinder::new(app_dir)),
            machine: Arc::new(registry::WindowsMachineConfig),
            services: Arc::new(services::ScServiceControl),
            riot: Arc::new(riot_client::WindowsRiotClient),
            downloader: Arc::new(downloader::HttpDownloader),
            prompt: Arc::new(prompt::DialogPrompt { app: app.clone() }),
            sink: Arc::new(events::TauriEventSink { app: app.clone() }),
            keys: Arc::new(key_simulator::WindowsKeySimulator),
        };
        let config_dir = app.path().app_config_dir().unwrap_or_default();
        let settings_store = SettingsStore::new(config_dir.clone());
        let settings = settings_store.load();
        let accounts = Arc::new(account_store::WindowsAccountStore::new(config_dir.clone()));
        let riot_login = Arc::new(riot_login::WindowsRiotLogin);
        let sessions = Arc::new(session_snapshot::WindowsSessionSnapshotStore::new(config_dir));
        Self {
            ports,
            accounts,
            riot_login,
            sessions,
            active_stop: Mutex::new(None),
            settings: Mutex::new(settings),
            registered_shortcut: Mutex::new(None),
            account_swap_last_used: Mutex::new(None),
            settings_store,
        }
    }

    pub fn current_settings(&self) -> Settings {
        self.settings.lock().unwrap().clone()
    }

    pub fn save_settings(&self, settings: Settings) -> Result<(), AppError> {
        self.settings_store.save(&settings)?;
        *self.settings.lock().unwrap() = settings;
        Ok(())
    }
}
