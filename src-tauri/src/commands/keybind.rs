use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::error::AppError;
use crate::state::AppState;

pub fn sync_insert_shortcut(app: &AppHandle, state: &AppState, enabled: bool, keybind: Option<&str>) -> Result<(), AppError> {
    let shortcuts = app.global_shortcut();
    let mut registered = state.registered_shortcut.lock().unwrap();

    if let Some(old) = registered.take() {
        let _ = shortcuts.unregister(old.as_str());
    }

    let Some(key) = keybind.filter(|_| enabled) else { return Ok(()) };

    let app_for_handler = app.clone();
    let literal = code_to_literal(key);
    shortcuts
        .on_shortcut(key, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(state) = app_for_handler.try_state::<AppState>() {

                    if let Some(literal) = literal {
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

fn code_to_literal(code: &str) -> Option<&'static str> {
    match code {
        "Backquote" => Some("`"),
        "Minus" => Some("-"),
        "Equal" => Some("="),
        "BracketLeft" => Some("["),
        "BracketRight" => Some("]"),
        "Backslash" => Some("\\"),
        "Semicolon" => Some(";"),
        "Quote" => Some("'"),
        "Comma" => Some(","),
        "Period" => Some("."),
        "Slash" => Some("/"),
        _ if code.starts_with("Key") => key_char(code, 3),
        _ if code.starts_with("Digit") => key_char(code, 5),
        _ => None,
    }
}

fn key_char(code: &str, prefix_len: usize) -> Option<&'static str> {
    const LOWER: [&str; 26] =
        ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
    const DIGITS: [&str; 10] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

    let rest = &code[prefix_len..];
    if let Some(letter) = rest.chars().next().filter(|c| c.is_ascii_alphabetic()) {
        return LOWER.get((letter.to_ascii_lowercase() as u8 - b'a') as usize).copied();
    }
    if let Some(digit) = rest.chars().next().filter(|c| c.is_ascii_digit()) {
        return DIGITS.get((digit as u8 - b'0') as usize).copied();
    }
    None
}
