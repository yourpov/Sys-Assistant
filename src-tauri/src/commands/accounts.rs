use std::collections::HashSet;

use tauri::State;

use super::workflow::{log_failure, try_take_stop_token};
use crate::application::account_login;
use crate::application::riot_watchdog::AccountRiotFlowGuard;
use crate::application::account_txt::{build_export_text, parse_import_text};
use crate::dto::{AccountDto, ExportAccountsResultDto, ImportAccountsResultDto};
use crate::invoke_error::{InvokeErrorDto, invoke_err, invoke_err_msg};
use crate::state::AppState;

#[tauri::command]
pub fn list_accounts(state: State<'_, AppState>) -> Result<Vec<AccountDto>, InvokeErrorDto> {
    Ok(state
        .accounts
        .list()
        .into_iter()
        .map(|account| {
            let has_session = state.sessions.has_snapshot(&account.id);
            AccountDto { has_session, ..AccountDto::from(account) }
        })
        .collect())
}

#[tauri::command]
pub fn add_account(state: State<'_, AppState>, label: String, username: String, password: String) -> Result<AccountDto, InvokeErrorDto> {
    state.accounts.add(label, username, password).map(AccountDto::from).map_err(invoke_err)
}

#[tauri::command]
pub fn update_account(state: State<'_, AppState>, id: String, label: String, username: String, password: Option<String>) -> Result<(), InvokeErrorDto> {
    state.accounts.update(&id, label, username, password).map_err(invoke_err)
}

#[tauri::command]
pub fn remove_account(state: State<'_, AppState>, id: String) -> Result<(), InvokeErrorDto> {
    state.accounts.remove(&id).map_err(invoke_err)?;
    let _ = state.sessions.forget(&id);
    Ok(())
}

#[tauri::command]
pub fn set_account_notes(state: State<'_, AppState>, id: String, notes: Option<String>) -> Result<(), InvokeErrorDto> {
    state.accounts.set_notes(&id, notes).map_err(invoke_err)
}

#[tauri::command]
pub fn set_account_full_access(state: State<'_, AppState>, id: String, full_access: bool) -> Result<(), InvokeErrorDto> {
    state.accounts.set_full_access(&id, full_access).map_err(invoke_err)
}

#[tauri::command]
pub fn set_account_category(state: State<'_, AppState>, id: String, category: Option<String>) -> Result<(), InvokeErrorDto> {
    state.accounts.set_category(&id, category).map_err(invoke_err)
}

#[tauri::command]
pub fn set_account_region(state: State<'_, AppState>, id: String, region: Option<String>) -> Result<(), InvokeErrorDto> {
    state.accounts.set_region(&id, region).map_err(invoke_err)
}

#[tauri::command]
pub fn reorder_accounts(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), InvokeErrorDto> {
    state.accounts.reorder(&ids).map_err(invoke_err)
}

#[tauri::command]
pub async fn login_account(state: State<'_, AppState>, id: String) -> Result<(), InvokeErrorDto> {
    let _flow_guard = AccountRiotFlowGuard::new(&state);
    let guard       = try_take_stop_token(&state)?;
    account_login::login(&id, state.accounts.as_ref(), state.sessions.as_ref(), state.riot_login.as_ref(), &state.ports, &guard.token)
        .await
        .inspect_err(|e| log_failure(&state.ports, e))
        .map_err(invoke_err)
}

#[tauri::command]
pub fn forget_account_session(state: State<'_, AppState>, id: String) -> Result<(), InvokeErrorDto> {
    state.sessions.forget(&id).map_err(invoke_err)
}

#[tauri::command]
pub fn export_accounts_txt(state: State<'_, AppState>, path: String) -> Result<ExportAccountsResultDto, InvokeErrorDto> {
    let accounts = state.accounts.list();
    if accounts.is_empty() {
        return Err(invoke_err_msg(
            "export_empty",
            "Your accounts couldn't be exported",
            "Add at least one account first, then try again.",
            "no accounts to export",
        ));
    }

    let mut passwords = Vec::with_capacity(accounts.len());
    let mut errors    = Vec::new();

    for account in &accounts {
        match state.accounts.password(&account.id) {
            Ok(password) => passwords.push((account.id.clone(), password)),
            Err(error)   => errors.push(format!("couldn't read password for {}: {error}", account.label)),
        }
    }

    if passwords.is_empty() {
        return Err(invoke_err_msg(
            "export_passwords_failed",
            "Your account passwords couldn't be read",
            "Re-enter passwords on the Accounts page, then try again.",
            "couldn't read any account passwords to export",
        ));
    }

    let exportable: Vec<_> = accounts
        .iter()
        .filter(|account| passwords.iter().any(|(id, _)| id == &account.id))
        .cloned()
        .collect();

    let text = build_export_text(&exportable, &passwords);
    std::fs::write(&path, text).map_err(|error| {
        invoke_err_msg(
            "export_write_failed",
            "Your export file couldn't be saved",
            "Pick a different folder or check that you have write permission, then try again.",
            format!("couldn't write export file ({error})"),
        )
    })?;

    Ok(ExportAccountsResultDto {
        exported: exportable.len() as u32,
        errors,
    })
}

#[tauri::command]
pub fn import_accounts_txt(state: State<'_, AppState>, path: String) -> Result<ImportAccountsResultDto, InvokeErrorDto> {
    let raw = std::fs::read_to_string(&path).map_err(|error| {
        invoke_err_msg(
            "import_read_failed",
            "Your import file couldn't be read",
            "Check the file path and try again.",
            format!("couldn't read import file ({error})"),
        )
    })?;
    let (entries, mut errors) = parse_import_text(&raw);

    if entries.is_empty() && errors.is_empty() {
        return Err(invoke_err_msg(
            "import_empty",
            "Your import file had no accounts",
            "Add user:pass lines to the file, then try again.",
            "import file didn't contain any accounts",
        ));
    }

    let existing                            = state.accounts.list();
    let mut seen_usernames: HashSet<String> = existing.iter().map(|account| account.username.to_ascii_lowercase()).collect();
    let mut added                           = Vec::new();
    let mut skipped_duplicates              = 0u32;

    for entry in entries {
        let username_key = entry.username.to_ascii_lowercase();
        if seen_usernames.contains(&username_key) {
            skipped_duplicates += 1;
            continue;
        }

        match state.accounts.add(entry.label.clone(), entry.username.clone(), entry.password) {
            Ok(account) => {
                seen_usernames.insert(username_key);
                added.push(AccountDto::from(account));
            }
            Err(error) => errors.push(format!("couldn't add {}: {error}", entry.label)),
        }
    }

    if added.is_empty() && skipped_duplicates == 0 && !errors.is_empty() {
        return Err(invoke_err_msg(
            "import_failed",
            "Your accounts couldn't be imported",
            "Fix the lines noted in the file format and try again.",
            errors.join("\n"),
        ));
    }

    Ok(ImportAccountsResultDto {
        added,
        skipped_duplicates,
        errors,
    })
}