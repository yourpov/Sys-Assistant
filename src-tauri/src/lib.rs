mod application;
mod commands;
mod domain;
mod dto;
mod error;
mod infrastructure;
mod state;

use tauri::Manager;

use state::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = AppState::new(app.handle());
            let settings = state.current_settings();
            if settings.is_always_on_top {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_always_on_top(true);
                }
            }
            let _ = commands::keybind::sync_insert_shortcut(
                app.handle(),
                &state,
                settings.insert_sim_enabled,
                settings.insert_sim_keybind.as_deref(),
            );
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::workflow::run_action,
            commands::workflow::run_manual_action,
            commands::workflow::run_account_swap,
            commands::workflow::get_settings,
            commands::workflow::save_settings,
            commands::workflow::find_file_path,
            commands::workflow::cancel_action,
            commands::workflow::check_for_issues,
            commands::workflow::fix_issues,
            commands::workflow::restart_computer,
            commands::credit::get_app_credit,
            commands::changelog::fetch_changelog,
            commands::tools::lookup_account,
            commands::tools::fetch_match_info,
            commands::accounts::list_accounts,
            commands::accounts::add_account,
            commands::accounts::update_account,
            commands::accounts::remove_account,
            commands::accounts::login_account,
            commands::accounts::forget_account_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
