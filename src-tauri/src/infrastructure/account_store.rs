use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Once;

use keyring_core::Entry;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::application::ports::AccountStore;
use crate::domain::Account;
use crate::error::AppError;

const KEYRING_SERVICE: &str = "gg.sysinfo.automate";
static INIT_STORE: Once = Once::new();

fn ensure_store_registered() {
    INIT_STORE.call_once(|| {
        if let Ok(store) = windows_native_keyring_store::Store::new() {
            keyring_core::set_default_store(store);
        }
    });
}

fn entry(id: &str) -> Result<Entry, AppError> {
    ensure_store_registered();
    let modifiers = HashMap::from([("persistence", "Local")]);
    Entry::new_with_modifiers(KEYRING_SERVICE, id, &modifiers)
        .map_err(|e| AppError::Account(format!("couldn't access secure storage ({e})")))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredAccount {
    id: String,
    label: String,
    username: String,
}

pub struct WindowsAccountStore {
    path: PathBuf,
}

impl WindowsAccountStore {
    pub fn new(config_dir: PathBuf) -> Self {
        Self { path: config_dir.join("accounts.json") }
    }

    fn load(&self) -> Vec<StoredAccount> {
        let Ok(raw) = std::fs::read_to_string(&self.path) else { return Vec::new() };
        serde_json::from_str(&raw).unwrap_or_default()
    }

    fn save(&self, accounts: &[StoredAccount]) -> Result<(), AppError> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Account(format!("couldn't save accounts ({e})")))?;
        }
        let json = serde_json::to_string_pretty(accounts).map_err(|e| AppError::Account(format!("couldn't save accounts ({e})")))?;
        std::fs::write(&self.path, json).map_err(|e| AppError::Account(format!("couldn't save accounts ({e})")))
    }

    fn set_password(&self, id: &str, password: &str) -> Result<(), AppError> {
        entry(id)?.set_password(password).map_err(|e| AppError::Account(format!("couldn't save the password securely ({e})")))
    }

    fn delete_password(&self, id: &str) {
        if let Ok(entry) = entry(id) {
            let _ = entry.delete_credential();
        }
    }
}

fn duplicate_error(username: &str) -> AppError {
    AppError::Account(format!("an account for \"{username}\" already exists. edit it or remove it instead of adding it again"))
}

impl AccountStore for WindowsAccountStore {
    fn list(&self) -> Vec<Account> {
        self.load().into_iter().map(|a| Account { id: a.id, label: a.label, username: a.username }).collect()
    }

    fn add(&self, label: String, username: String, password: String) -> Result<Account, AppError> {
        let mut accounts = self.load();
        let username = username.trim().to_string();
        if accounts.iter().any(|a| a.username.eq_ignore_ascii_case(&username)) {
            return Err(duplicate_error(&username));
        }
        let id = Uuid::new_v4().to_string();
        self.set_password(&id, &password)?;
        accounts.push(StoredAccount { id: id.clone(), label: label.clone(), username: username.clone() });
        self.save(&accounts)?;
        Ok(Account { id, label, username })
    }

    fn update(&self, id: &str, label: String, username: String, password: Option<String>) -> Result<(), AppError> {
        let mut accounts = self.load();
        let username = username.trim().to_string();
        if accounts.iter().any(|a| a.id != id && a.username.eq_ignore_ascii_case(&username)) {
            return Err(duplicate_error(&username));
        }
        let account = accounts
            .iter_mut()
            .find(|a| a.id == id)
            .ok_or_else(|| AppError::Account("that account no longer exists. refresh the list and try again".into()))?;
        account.label = label;
        account.username = username;
        if let Some(password) = password {
            self.set_password(id, &password)?;
        }
        self.save(&accounts)
    }

    fn remove(&self, id: &str) -> Result<(), AppError> {
        let mut accounts = self.load();
        accounts.retain(|a| a.id != id);
        self.delete_password(id);
        self.save(&accounts)
    }

    fn password(&self, id: &str) -> Result<String, AppError> {
        entry(id)?.get_password().map_err(|e| AppError::Account(format!("couldn't read the saved password ({e})")))
    }
}
