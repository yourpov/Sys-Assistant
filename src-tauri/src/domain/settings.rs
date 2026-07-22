use std::path::PathBuf;
use std::time::Duration;

use super::action::ManualAction;

#[derive(Debug, Clone)]
pub struct Settings {
    pub check_every                        : Duration,
    pub close_wait                         : Duration,
    pub val_launch_timeout                 : Duration,
    pub emu_path                           : Option<PathBuf>,
    pub loader_path                        : Option<PathBuf>,
    pub tracex_path                        : Option<PathBuf>,
    pub tracex_tui_path                    : Option<PathBuf>,
    pub tracex_use_tui                     : bool,
    pub is_always_on_top                   : bool,
    pub insert_sim_enabled                 : bool,
    pub insert_sim_keybind                 : Option<String>,
    pub manual_actions_enabled             : Vec<ManualAction>,
    pub account_swap_pool                  : Vec<String>,
    pub henrik_api_keys                    : Vec<String>,
    pub auto_run_loader_enabled            : bool,
    pub auto_run_loader_on_valorant        : bool,
    pub toast_os_notifications_enabled     : bool,
    pub confirm_before_actions_enabled     : bool,
    pub hide_account_usernames             : bool,
    pub reduce_animations_enabled          : bool,
    pub mute_alert_sounds_enabled          : bool,
    pub accent_color                       : Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            check_every                        : Duration::from_secs(2),
            close_wait                         : Duration::from_secs(2),
            val_launch_timeout                 : Duration::from_secs(60),
            emu_path                           : None,
            loader_path                        : None,
            tracex_path                        : None,
            tracex_tui_path                    : None,
            tracex_use_tui                     : false,
            is_always_on_top                   : false,
            insert_sim_enabled                 : false,
            insert_sim_keybind                 : None,
            manual_actions_enabled             : vec![ManualAction::ToggleValorant, ManualAction::ToggleRiotClient, ManualAction::OpenTraceX, ManualAction::ChangeSeed],
            account_swap_pool                  : Vec::new(),
            henrik_api_keys                    : Vec::new(),
            auto_run_loader_enabled            : true,
            auto_run_loader_on_valorant        : false,
            toast_os_notifications_enabled     : false,
            confirm_before_actions_enabled     : false,
            hide_account_usernames             : true,
            reduce_animations_enabled          : false,
            mute_alert_sounds_enabled          : false,
            accent_color                       : None,
        }
    }
}
