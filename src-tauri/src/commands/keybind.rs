use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::error::AppError;
use crate::state::AppState;

pub fn sync_insert_shortcut(app: &AppHandle, state: &AppState, enabled: bool, keybind: Option<&str>) -> Result<(), AppError> {
    let shortcuts      = app.global_shortcut();
    let mut registered = state.registered_shortcut.lock().unwrap();

    if let Some(old) = registered.clone() {
        shortcuts
            .unregister(old.as_str())
            .map_err(|e| AppError::Input(format!("couldn't unregister the previous keybind \"{old}\" ({e})")))?;
        *registered = None;
    }

    let Some(key) = keybind.filter(|_| enabled) else { return Ok(()) };

    let app_for_handler = app.clone();
    let literal         = code_to_literal(key);
    shortcuts
        .on_shortcut(key, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(state) = app_for_handler.try_state::<AppState>() {
                    if let Some(literal) = &literal {
                        let _ = state.ports.keys.press_key(literal);
                    }
                    let _ = state.ports.keys.press_insert();
                }
            }
        })
        .map_err(|e| AppError::Input(format!("couldn't register the keybind \"{key}\" ({e})")))?;

    *registered = Some(key.to_string());
    Ok(())
}

fn code_to_literal(code: &str) -> Option<String> {
    match code {
        "Backquote"                  => Some("`".to_string()),
        "Minus"                      => Some("-".to_string()),
        "Equal"                      => Some("=".to_string()),
        "BracketLeft"                => Some("[".to_string()),
        "BracketRight"               => Some("]".to_string()),
        "Backslash"                  => Some("\\".to_string()),
        "Semicolon"                  => Some(";".to_string()),
        "Quote"                      => Some("'".to_string()),
        "Comma"                      => Some(",".to_string()),
        "Period"                     => Some(".".to_string()),
        "Slash"                      => Some("/".to_string()),
        _ if code.starts_with("Key")   => key_char(code, "Key".len()),
        _ if code.starts_with("Digit") => key_char(code, "Digit".len()),
        _                            => None,
    }
}

fn key_char(code: &str, prefix_len: usize) -> Option<String> {
    let ch = code[prefix_len..].chars().next()?;
    if ch.is_ascii_alphabetic() {
        return Some(ch.to_ascii_lowercase().to_string());
    }
    if ch.is_ascii_digit() {
        return Some(ch.to_string());
    }
    None
}
