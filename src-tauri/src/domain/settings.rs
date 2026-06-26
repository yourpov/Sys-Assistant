use std::path::PathBuf;
use std::time::Duration;

use super::action::ManualAction;

#[derive(Debug, Clone)]
pub struct Settings {
    pub temp_val_wait: Duration,
    pub sesh_wait: Duration,
    pub check_every: Duration,
    pub close_wait: Duration,
    pub val_launch_timeout: Duration,
    pub emu_path: Option<PathBuf>,
    pub loader_path: Option<PathBuf>,
    pub sesh_path: Option<PathBuf>,
    pub is_always_on_top: bool,
    pub insert_sim_enabled: bool,
    pub insert_sim_keybind: Option<String>,
    pub manual_actions_enabled: Vec<ManualAction>,
    pub account_swap_pool: Vec<String>,
    pub henrik_api_keys: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            temp_val_wait: Duration::from_secs(10),
            sesh_wait: Duration::from_secs(10),
            check_every: Duration::from_secs(2),
            close_wait: Duration::from_secs(2),
            val_launch_timeout: Duration::from_secs(60),
            emu_path: None,
            loader_path: None,
            sesh_path: None,
            is_always_on_top: false,
            insert_sim_enabled: false,
            insert_sim_keybind: None,
            manual_actions_enabled: vec![ManualAction::ToggleValorant, ManualAction::ToggleRiotClient, ManualAction::OpenLoader, ManualAction::ChangeSeed],
            account_swap_pool: Vec::new(),
            henrik_api_keys: Vec::new(),
        }
    }
}
