use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager};

use crate::application::ports::{AccountStore, Ports, RiotLogin, SessionSnapshotStore};
use crate::application::run_workflow::StopToken;
use crate::domain::Settings;
use crate::error::AppError;
use crate::infrastructure::app_log::AppLogStore;
use crate::infrastructure::auth_store::AuthStore;
use crate::infrastructure::discord_auth::AuthSession;
use crate::infrastructure::settings_store::SettingsStore;
use crate::infrastructure::sync_lock::lock_or_recover;
use crate::infrastructure::{
    account_store, downloader, events, files, key_simulator, launcher, process, prompt, registry, riot_client, riot_login, services, session_snapshot,
};
use crate::infrastructure::saved_players_store::SavedPlayersStore;

pub struct AppState {
    pub ports                  : Ports,
    pub accounts               : Arc<dyn AccountStore>,
    pub saved_players          : SavedPlayersStore,
    pub riot_login             : Arc<dyn RiotLogin>,
    pub sessions               : Arc<dyn SessionSnapshotStore>,
    pub app_log                : Arc<AppLogStore>,
    pub active_stop            : Mutex<Option<StopToken>>,
    pub settings               : Mutex<Settings>,
    pub registered_shortcut    : Mutex<Option<String>>,
    pub account_swap_last_used : Mutex<Option<String>>,
    pub auth_session           : Mutex<Option<AuthSession>>,
    pub pending_pkce_verifier  : Mutex<Option<String>>,
    pub auth_refresh_lock      : tokio::sync::Mutex<()>,
    pub auth_store             : AuthStore,
    settings_store         : SettingsStore,
}

impl AppState {
    pub fn new(app: &AppHandle) -> Self {
        let app_dir = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
            .unwrap_or_default();
        let config_dir = app.path().app_config_dir().unwrap_or_default();
        let app_log = Arc::new(AppLogStore::default());
        let machine = Arc::new(registry::WindowsMachineConfig);
        let riot    = Arc::new(riot_client::WindowsRiotClient::new());
        let ports = Ports {
            processes     : Arc::new(process::SysinfoProcessMonitor::new()),
            launcher      : Arc::new(launcher::WindowsLauncher),
            files         : Arc::new(files::AppDirFileFinder::new(app_dir)),
            system_health : machine.clone(),
            emu_env       : machine,
            services      : Arc::new(services::ScServiceControl),
            riot_runtime  : riot.clone(),
            riot_launch   : riot.clone(),
            riot_session  : riot,
            downloader    : Arc::new(downloader::HttpDownloader),
            prompt        : Arc::new(prompt::DialogPrompt { app: app.clone() }),
            sink          : Arc::new(events::TauriEventSink { app: app.clone(), app_log: app_log.clone() }),
            keys          : Arc::new(key_simulator::WindowsKeySimulator),
        };
        let settings_store = SettingsStore::new(config_dir.clone());
        let settings = settings_store.load();
        let accounts = Arc::new(account_store::WindowsAccountStore::new(config_dir.clone()));
        let saved_players = SavedPlayersStore::new(config_dir.clone());
        let riot_login = Arc::new(riot_login::WindowsRiotLogin);
        let sessions = Arc::new(session_snapshot::WindowsSessionSnapshotStore::new(config_dir.clone()));
        let auth_store = AuthStore::new(config_dir);
        let auth_session = auth_store.load();
        Self {
            ports,
            accounts,
            saved_players,
            riot_login,
            sessions,
            app_log,
            active_stop            : Mutex::new(None),
            settings               : Mutex::new(settings),
            registered_shortcut    : Mutex::new(None),
            account_swap_last_used : Mutex::new(None),
            auth_session           : Mutex::new(auth_session),
            pending_pkce_verifier  : Mutex::new(None),
            auth_refresh_lock      : tokio::sync::Mutex::new(()),
            auth_store,
            settings_store,
        }
    }

    pub fn current_settings(&self) -> Settings {
        lock_or_recover(&self.settings).clone()
    }

    pub fn save_settings(&self, settings: Settings) -> Result<(), AppError> {
        self.settings_store.save(&settings)?;
        *lock_or_recover(&self.settings) = settings;
        Ok(())
    }

    pub fn try_claim_stop_token(&self) -> Option<StopToken> {
        let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let mut guard = lock_or_recover(&self.active_stop);
        if guard.is_some() {
            return None;
        }
        *guard = Some(stop.clone());
        Some(stop)
    }

    pub fn release_stop_token_if_current(&self, token: &StopToken) {
        let mut guard = lock_or_recover(&self.active_stop);
        if guard.as_ref().is_some_and(|active| Arc::ptr_eq(active, token)) {
            *guard = None;
        }
    }
}
