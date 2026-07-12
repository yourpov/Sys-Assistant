use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, Once};

use keyring_core::Entry;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::application::ports::AccountStore;
use crate::domain::Account;
use crate::error::AppError;

const KEYRING_SERVICE: &str = "gg.sysinfo.automate";
static INIT_STORE: Once           = Once::new();
static ACCOUNT_STORE_LOCK: Mutex<()> = Mutex::new(());

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

fn default_full_access() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredAccount {
    id       : String,
    label    : String,
    username : String,
    #[serde(default)]
    notes    : Option<String>,
    #[serde(default = "default_full_access")]
    full_access: bool,
    #[serde(default)]
    category : Option<String>,
    #[serde(default)]
    region   : Option<String>,
}

pub struct WindowsAccountStore {
    path: PathBuf,
}

impl WindowsAccountStore {
    pub fn new(config_dir: PathBuf) -> Self {
        Self { path: config_dir.join("accounts.json") }
    }

    fn load(&self) -> Result<Vec<StoredAccount>, AppError> {
        let Ok(raw) = std::fs::read_to_string(&self.path) else { return Ok(Vec::new()) };
        serde_json::from_str(&raw).map_err(|e| {
            AppError::Account(format!(
                "accounts.json couldn't be read (it may be corrupt). restore from backup before saving again ({e})"
            ))
        })
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
        let _guard = ACCOUNT_STORE_LOCK.lock().unwrap();
        self.load()
            .unwrap_or_default()
            .into_iter()
            .map(|a| Account {
                id          : a.id,
                label       : a.label,
                username    : a.username,
                notes       : a.notes,
                full_access : a.full_access,
                category    : a.category,
                region      : a.region,
            })
            .collect()
    }

    fn add(&self, label: String, username: String, password: String) -> Result<Account, AppError> {
        let _guard = ACCOUNT_STORE_LOCK.lock().unwrap();
        let mut accounts = self.load()?;
        let username     = username.trim().to_string();
        if accounts.iter().any(|a| a.username.eq_ignore_ascii_case(&username)) {
            return Err(duplicate_error(&username));
        }
        let id = Uuid::new_v4().to_string();
        self.set_password(&id, &password)?;
        accounts.push(StoredAccount {
            id          : id.clone(),
            label       : label.clone(),
            username    : username.clone(),
            notes       : None,
            full_access : true,
            category    : None,
            region      : None,
        });
        if let Err(e) = self.save(&accounts) {
            self.delete_password(&id);
            return Err(e);
        }
        Ok(Account { id, label, username, notes: None, full_access: true, category: None, region: None })
    }

    fn update(&self, id: &str, label: String, username: String, password: Option<String>) -> Result<(), AppError> {
        let _guard = ACCOUNT_STORE_LOCK.lock().unwrap();
        let mut accounts = self.load()?;
        let username     = username.trim().to_string();
        if accounts.iter().any(|a| a.id != id && a.username.eq_ignore_ascii_case(&username)) {
            return Err(duplicate_error(&username));
        }
        let account = accounts
            .iter_mut()
            .find(|a| a.id == id)
            .ok_or_else(|| AppError::Account("that account no longer exists. refresh the list and try again".into()))?;
           account.label      = label;
           account.username   = username;
        if let Some(password) = password {
            self.set_password(id, &password)?;
        }
        self.save(&accounts)
    }

    fn remove(&self, id: &str) -> Result<(), AppError> {
        let _guard = ACCOUNT_STORE_LOCK.lock().unwrap();
        let mut accounts = self.load()?;
        accounts.retain(|a| a.id != id);
        self.delete_password(id);
        self.save(&accounts)
    }

    fn password(&self, id: &str) -> Result<String, AppError> {
        entry(id)?.get_password().map_err(|e| AppError::Account(format!("couldn't read the saved password ({e})")))
    }

    fn set_notes(&self, id: &str, notes: Option<String>) -> Result<(), AppError> {
        let _guard = ACCOUNT_STORE_LOCK.lock().unwrap();
        let mut accounts = self.load()?;
        let account = accounts
            .iter_mut()
            .find(|a| a.id == id)
            .ok_or_else(|| AppError::Account("that account no longer exists. refresh the list and try again".into()))?;
        account.notes = notes.filter(|n| !n.trim().is_empty());
        self.save(&accounts)
    }

    fn set_full_access(&self, id: &str, full_access: bool) -> Result<(), AppError> {
        let _guard = ACCOUNT_STORE_LOCK.lock().unwrap();
        let mut accounts = self.load()?;
        let account = accounts
            .iter_mut()
            .find(|a| a.id == id)
            .ok_or_else(|| AppError::Account("that account no longer exists. refresh the list and try again".into()))?;
        account.full_access = full_access;
        self.save(&accounts)
    }

    fn set_category(&self, id: &str, category: Option<String>) -> Result<(), AppError> {
        let _guard = ACCOUNT_STORE_LOCK.lock().unwrap();
        let mut accounts = self.load()?;
        let account = accounts
            .iter_mut()
            .find(|a| a.id == id)
            .ok_or_else(|| AppError::Account("that account no longer exists. refresh the list and try again".into()))?;
        account.category = category.filter(|c| !c.trim().is_empty());
        self.save(&accounts)
    }

    fn set_region(&self, id: &str, region: Option<String>) -> Result<(), AppError> {
        let _guard = ACCOUNT_STORE_LOCK.lock().unwrap();
        let mut accounts = self.load()?;
        let account = accounts
            .iter_mut()
            .find(|a| a.id == id)
            .ok_or_else(|| AppError::Account("that account no longer exists. refresh the list and try again".into()))?;
        account.region = region.filter(|r| !r.trim().is_empty());
        self.save(&accounts)
    }

    fn reorder(&self, ids: &[String]) -> Result<(), AppError> {
        let _guard = ACCOUNT_STORE_LOCK.lock().unwrap();
        let accounts = self.load()?;
        let mut by_id: HashMap<String, StoredAccount> = accounts
            .iter()
            .map(|account| (account.id.clone(), account.clone()))
            .collect();

        let mut reordered = Vec::with_capacity(accounts.len());
        for id in ids {
            if let Some(account) = by_id.remove(id) {
                reordered.push(account);
            }
        }
        for account in accounts {
            if by_id.contains_key(&account.id) {
                reordered.push(account);
            }
        }
        self.save(&reordered)
    }
}
