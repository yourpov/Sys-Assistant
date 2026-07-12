mod application;
mod commands;
mod domain;
mod dto;
mod error;
mod invoke_error;
mod infrastructure;
mod state;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

pub use invoke_error::{InvokeErrorDto, henrik_api_key_missing, invoke_err, invoke_err_msg, sign_in_required};
use state::AppState;

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn is_auth_callback_url(url: impl AsRef<str>) -> bool {
    url.as_ref().starts_with("sysautomate://auth-callback")
}

async fn handle_auth_callback(app: AppHandle, url: String) {
    if !is_auth_callback_url(&url) {
        return;
    }

    let result = {
        let state = app.state::<AppState>();
        application::discord_auth_flow::handle_callback(&state, &url).await
    };

    focus_main_window(&app);

    match result {
        Ok(session) => {
            let dto: crate::dto::AuthSessionDto = session.into();
            let _ = app.emit("discord-auth://changed", Some(dto));
        }
        Err(e) => {
            let _ = app.emit("discord-auth://error", e.to_string());
        }
    }
}

pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_main_window(app);
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_deep_link::init())
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
            tauri::async_runtime::spawn(application::sesh_watchdog::run(app.handle().clone()));
            tauri::async_runtime::spawn(application::anti_temp_ban_watchdog::run(app.handle().clone()));
            tauri::async_runtime::spawn(application::riot_watchdog::run(app.handle().clone()));

            #[cfg(any(windows, target_os = "linux"))]
            app.deep_link().register_all()?;

            let auth_app_handle = app.handle().clone();
            if let Ok(Some(start_urls)) = app.deep_link().get_current() {
                for start_url in start_urls {
                    let callback_url = start_url.to_string();
                    if is_auth_callback_url(&callback_url) {
                        let app_handle = auth_app_handle.clone();
                        tauri::async_runtime::spawn(handle_auth_callback(app_handle, callback_url));
                    }
                }
            }

            app.deep_link().on_open_url(move |event| {
                let auth_app_handle = auth_app_handle.clone();
                for opened_url in event.urls() {
                    let callback_url = opened_url.to_string();
                    if is_auth_callback_url(&callback_url) {
                        let app_handle = auth_app_handle.clone();
                        tauri::async_runtime::spawn(handle_auth_callback(app_handle, callback_url));
                    }
                }
            });

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
            commands::workflow::release_workflow_stop,
            commands::workflow::restart_computer,
            commands::credit::get_app_credit,
            commands::changelog::fetch_changelog,
            commands::collection::fetch_collection,
            commands::collection::get_riot_client_status,
            commands::collection::open_riot_client,
            commands::feedback::submit_feedback,
            commands::tools::lookup_account,
            commands::tools::lookup_account_profile,
            commands::tools::lookup_account_extras,
            commands::tools::fetch_match_info,
            commands::tools::detect_current_account,
            commands::tools::detect_current_account_profile,
            commands::tools::fetch_live_match_snapshot,
            commands::tools::fetch_valorant_version_status,
            commands::accounts::list_accounts,
            commands::accounts::add_account,
            commands::accounts::update_account,
            commands::accounts::remove_account,
            commands::accounts::set_account_notes,
            commands::accounts::set_account_full_access,
            commands::accounts::set_account_category,
            commands::accounts::set_account_region,
            commands::accounts::reorder_accounts,
            commands::accounts::login_account,
            commands::accounts::forget_account_session,
            commands::accounts::export_accounts_txt,
            commands::accounts::import_accounts_txt,
            commands::saved_players::list_saved_players,
            commands::saved_players::add_saved_player,
            commands::saved_players::remove_saved_player,
            commands::applog::read_app_log,
            commands::applog::clear_app_log,
            commands::applog::append_app_log,
            commands::auth::start_discord_sign_in,
            commands::auth::sign_in_as_guest,
            commands::auth::sign_out,
            commands::auth::current_auth_session,
            commands::community_configs::fetch_community_configs,
            commands::community_configs::fetch_config_comments,
            commands::community_configs::fetch_config_reaction,
            commands::community_configs::set_config_reaction,
            commands::community_configs::clear_config_reaction,
            commands::community_configs::post_config_comment,
            commands::community_configs::update_config_comment,
            commands::community_configs::delete_config_comment,
            commands::community_configs::create_config,
            commands::community_configs::update_config,
            commands::community_configs::delete_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
