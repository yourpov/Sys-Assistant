use rand::seq::SliceRandom;

use super::account_login;
use super::ports::{AccountStore, LogLevel, Ports, RiotLogin, SessionSnapshotStore};
use super::run_workflow::{self, StopToken};
use crate::domain::Settings;
use crate::error::AppError;

pub fn pick_next_account(pool: &[String], last_used: Option<&str>) -> Option<String> {
    if pool.len() <= 1 {
        return pool.first().cloned();
    }
    let others: Vec<&String> = pool.iter().filter(|id| Some(id.as_str()) != last_used).collect();
    others.choose(&mut rand::thread_rng()).map(|s| s.to_string()).or_else(|| pool.first().cloned())
}

pub fn filter_existing_accounts(pool: &[String], accounts: &dyn AccountStore) -> Vec<String> {
    let existing: std::collections::HashSet<String> = accounts.list().into_iter().map(|a| a.id).collect();
    pool.iter().filter(|id| existing.contains(id.as_str())).cloned().collect()
}

pub async fn run(
    pool      : &[String],
    last_used : Option<&str>,
    accounts  : &dyn AccountStore,
    sessions  : &dyn SessionSnapshotStore,
    riot_login: &dyn RiotLogin,
    settings  : &Settings,
    ports     : &Ports,
    stop      : &StopToken,
) -> Result<String, AppError> {
    let pool = filter_existing_accounts(pool, accounts);
    let last_used = last_used.filter(|id| pool.iter().any(|p| p == id));

    let account_id = pick_next_account(&pool, last_used)
        .ok_or_else(|| AppError::Account("no accounts chosen for Account Swap. select at least one in Settings, Automation and try again".into()))?;

    run_workflow::check_cancelled(stop)?;
    run_workflow::find_loader(ports, settings.loader_path.as_deref())?;
    run_workflow::find_required(ports, run_workflow::EMU_INSTALLER_EXE, settings.emu_path.as_deref())?;

    run_workflow::close_valorant_if_running(ports, settings, stop).await?;
    account_login::login(&account_id, accounts, sessions, riot_login, ports, stop).await?;

    run_workflow::run_post_login_start_process(ports, settings, stop).await?;

    ports.sink.emit_line(LogLevel::Ok, "ready");
    Ok(account_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::test_support::FakeAccountStore;
    use crate::domain::Account;
    use std::collections::HashMap;
    use std::sync::Mutex;

    #[test]
    fn one_account_always_picks_that_account() {
        let pool = vec!["a".to_string()];
        assert_eq!(pick_next_account(&pool, None), Some("a".to_string()));
        assert_eq!(pick_next_account(&pool, Some("a")), Some("a".to_string()));
    }

    #[test]
    fn two_accounts_always_swaps_to_the_other_one() {
        let pool = vec!["a".to_string(), "b".to_string()];
        assert_eq!(pick_next_account(&pool, Some("a")), Some("b".to_string()));
        assert_eq!(pick_next_account(&pool, Some("b")), Some("a".to_string()));
    }

    #[test]
    fn no_accounts_selected_returns_none() {
        assert_eq!(pick_next_account(&[], None), None);
    }

    #[test]
    fn three_or_more_never_repeats_the_last_one() {
        let pool = vec!["a".to_string(), "b".to_string(), "c".to_string()];
        for _ in 0..50 {
            let picked = pick_next_account(&pool, Some("a")).unwrap();
            assert_ne!(picked, "a");
        }
    }

    #[test]
    fn filter_existing_accounts_drops_deleted_ids() {
        let accounts = FakeAccountStore {
            accounts: Mutex::new(vec![Account {
                id: "a".into(),
                label: "A".into(),
                username: "a".into(),
                notes: None,
                full_access: true,
                category: None,
                region: None,
            }]),
            passwords: Mutex::new(HashMap::new()),
        };
        let filtered = filter_existing_accounts(&["a".into(), "gone".into()], &accounts);
        assert_eq!(filtered, vec!["a".to_string()]);
    }
}
