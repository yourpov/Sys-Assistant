use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::domain::Settings;
use crate::dto::ManualActionDto;
use crate::error::AppError;

#[derive(Debug, Default, Serialize, Deserialize)]
struct StoredSettings {
    temp_open_val_enabled          : Option<bool>,
    temp_val_wait_secs             : Option<u64>,
    sesh_wait_secs                 : Option<u64>,
    emu_path                       : Option<String>,
    loader_path                    : Option<String>,
    sesh_path                      : Option<String>,
    is_always_on_top               : Option<bool>,
    insert_sim_enabled             : Option<bool>,
    insert_sim_keybind             : Option<String>,
    manual_actions_enabled         : Option<Vec<ManualActionDto>>,
    account_swap_pool              : Option<Vec<String>>,
    henrik_api_keys                : Option<Vec<String>>,
    sesh_watchdog_enabled          : Option<bool>,
    anti_temp_ban_enabled          : Option<bool>,
    install_emu_on_riot_launch_enabled : Option<bool>,
    auto_fix_55_enabled                : Option<bool>,
    toast_os_notifications_enabled : Option<bool>,
    confirm_before_actions_enabled : Option<bool>,
    hide_account_usernames         : Option<bool>,
    reduce_animations_enabled      : Option<bool>,
    mute_alert_sounds_enabled      : Option<bool>,
    accent_color                   : Option<String>,
}

pub struct SettingsStore {
    path: PathBuf,
}

impl SettingsStore {
    pub fn new(config_dir: PathBuf) -> Self {
        Self { path: config_dir.join("settings.json") }
    }

    pub fn load(&self) -> Settings {
        let defaults = Settings::default();
        let Ok(raw) = std::fs::read_to_string(&self.path) else { return defaults };
        let Ok(stored) = serde_json::from_str::<StoredSettings>(&raw) else { return defaults };
        Settings {
            temp_open_val_enabled  : stored.temp_open_val_enabled.unwrap_or(defaults.temp_open_val_enabled),
            temp_val_wait          : stored.temp_val_wait_secs.map(Duration::from_secs).unwrap_or(defaults.temp_val_wait),
            sesh_wait              : stored.sesh_wait_secs.map(Duration::from_secs).unwrap_or(defaults.sesh_wait),
            emu_path               : stored.emu_path.map(PathBuf::from),
            loader_path            : stored.loader_path.map(PathBuf::from),
            sesh_path              : stored.sesh_path.map(PathBuf::from),
            is_always_on_top       : stored.is_always_on_top.unwrap_or(defaults.is_always_on_top),
            insert_sim_enabled     : stored.insert_sim_enabled.unwrap_or(defaults.insert_sim_enabled),
            insert_sim_keybind     : stored.insert_sim_keybind.or(defaults.insert_sim_keybind),
            manual_actions_enabled : stored
                .manual_actions_enabled
                .map(|actions| actions.into_iter().map(Into::into).collect())
                .unwrap_or(defaults.manual_actions_enabled),
            account_swap_pool: stored.account_swap_pool.unwrap_or(defaults.account_swap_pool),
            henrik_api_keys: stored.henrik_api_keys.unwrap_or(defaults.henrik_api_keys),
            sesh_watchdog_enabled: stored.sesh_watchdog_enabled.unwrap_or(defaults.sesh_watchdog_enabled),
            anti_temp_ban_enabled: stored.anti_temp_ban_enabled.unwrap_or(defaults.anti_temp_ban_enabled),
            install_emu_on_riot_launch_enabled: stored
                .install_emu_on_riot_launch_enabled
                .unwrap_or(defaults.install_emu_on_riot_launch_enabled),
            auto_fix_55_enabled: stored.auto_fix_55_enabled.unwrap_or(defaults.auto_fix_55_enabled),
            toast_os_notifications_enabled: stored.toast_os_notifications_enabled.unwrap_or(defaults.toast_os_notifications_enabled),
            confirm_before_actions_enabled: stored
                .confirm_before_actions_enabled
                .unwrap_or(defaults.confirm_before_actions_enabled),
            hide_account_usernames: stored.hide_account_usernames.unwrap_or(defaults.hide_account_usernames),
            reduce_animations_enabled: stored
                .reduce_animations_enabled
                .unwrap_or(defaults.reduce_animations_enabled),
            mute_alert_sounds_enabled: stored
                .mute_alert_sounds_enabled
                .unwrap_or(defaults.mute_alert_sounds_enabled),
            accent_color: stored.accent_color.or(defaults.accent_color),
            ..defaults
        }
    }

    pub fn save(&self, settings: &Settings) -> Result<(), AppError> {
        let stored = StoredSettings {
            temp_open_val_enabled: Some(settings.temp_open_val_enabled),
            temp_val_wait_secs: Some(settings.temp_val_wait.as_secs()),
            sesh_wait_secs: Some(settings.sesh_wait.as_secs()),
            emu_path: settings.emu_path.as_ref().map(|p| p.display().to_string()),
            loader_path: settings.loader_path.as_ref().map(|p| p.display().to_string()),
            sesh_path: settings.sesh_path.as_ref().map(|p| p.display().to_string()),
            is_always_on_top: Some(settings.is_always_on_top),
            insert_sim_enabled: Some(settings.insert_sim_enabled),
            insert_sim_keybind: settings.insert_sim_keybind.clone(),
            manual_actions_enabled: Some(settings.manual_actions_enabled.iter().map(|a| (*a).into()).collect()),
            account_swap_pool: Some(settings.account_swap_pool.clone()),
            henrik_api_keys: Some(settings.henrik_api_keys.clone()),
            sesh_watchdog_enabled: Some(settings.sesh_watchdog_enabled),
            anti_temp_ban_enabled: Some(settings.anti_temp_ban_enabled),
            install_emu_on_riot_launch_enabled: Some(settings.install_emu_on_riot_launch_enabled),
            auto_fix_55_enabled: Some(settings.auto_fix_55_enabled),
            toast_os_notifications_enabled: Some(settings.toast_os_notifications_enabled),
            confirm_before_actions_enabled: Some(settings.confirm_before_actions_enabled),
            hide_account_usernames: Some(settings.hide_account_usernames),
            reduce_animations_enabled: Some(settings.reduce_animations_enabled),
            mute_alert_sounds_enabled: Some(settings.mute_alert_sounds_enabled),
            accent_color: settings.accent_color.clone(),
        };
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Settings(e.to_string()))?;
        }
        let json = serde_json::to_string_pretty(&stored).map_err(|e| AppError::Settings(e.to_string()))?;
        std::fs::write(&self.path, json).map_err(|e| AppError::Settings(e.to_string()))
    }
}
