use rand::seq::SliceRandom;

use super::account_login;
use super::ports::{AccountStore, Ports, RiotLogin, SessionSnapshotStore};
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
    let account_id = pick_next_account(pool, last_used)
        .ok_or_else(|| AppError::Account("no accounts chosen for Account Swap. select at least one in Settings, Automation and try again".into()))?;

    run_workflow::check_cancelled(stop)?;
    run_workflow::find_required(ports, run_workflow::LOADER_EXE, settings.loader_path.as_deref())?;
    run_workflow::ensure_sesh(ports, settings, stop).await?;

    run_workflow::close_valorant_if_running(ports, settings, stop).await?;
    account_login::login(&account_id, accounts, sessions, riot_login, ports, stop).await?;

    run_workflow::wait_for_riot_to_settle(ports, stop).await?;
    if settings.auto_fix_55_enabled {
        run_workflow::apply_55_fix(ports, settings, stop).await?;
    }

    run_workflow::run_loader(ports, settings, stop).await?;
    run_workflow::open_valorant(ports, settings, stop).await?;
    run_workflow::start_session(ports, settings, stop, true).await?;

    Ok(account_id)
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
