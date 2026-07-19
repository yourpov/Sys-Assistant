use std::sync::atomic::Ordering;
use std::time::Duration;

use super::ports::{AccountStore, LogLevel, Ports, RiotLogin, SessionSnapshotStore};
use super::run_workflow::{self, StopToken, RIOT_CLIENT_PROCESS};
use crate::error::{AppError, RiotClientError};

const RIOT_KILL_POLL_INTERVAL: Duration = Duration::from_millis(200);
const RIOT_KILL_TIMEOUT: Duration       = Duration::from_secs(5);
const POST_KILL_BUFFER: Duration        = Duration::from_millis(300);

pub async fn login(
    account_id: &str,
    accounts  : &dyn AccountStore,
    sessions  : &dyn SessionSnapshotStore,
    riot_login: &dyn RiotLogin,
    ports     : &Ports,
    stop      : &StopToken,
) -> Result<(), AppError> {
    run_workflow::check_cancelled(stop)?;

    let account = accounts
        .list()
        .into_iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| AppError::Account("that account no longer exists. refresh the list and try again".into()))?;

    ports.sink.emit_line(LogLevel::Info, &format!("signing out and switching to {}", account.label));

    let install_dir = ports.riot_runtime.install_path().await.and_then(|path| path.parent().map(|p| p.to_path_buf()));

    ports.processes.kill_all(RIOT_CLIENT_PROCESS).await;
    ports.riot_session.invalidate_login_cache();
    run_workflow::wait_for_process_gone(ports, RIOT_CLIENT_PROCESS, RIOT_KILL_POLL_INTERVAL, RIOT_KILL_TIMEOUT, stop).await?;
    run_workflow::sleep_cancellable(POST_KILL_BUFFER, stop).await?;

    if sessions.has_snapshot(account_id) {
        run_workflow::check_cancelled(stop)?;
        sessions.restore(account_id, install_dir.as_deref(), &*ports.sink)?;
        ports.sink.emit_line(LogLevel::Info, "opening the riot client...");
        run_workflow::ensure_riot_running(ports, stop).await?;
        run_workflow::wait_for_riot_to_settle(ports, stop).await?;
        run_workflow::check_cancelled(stop)?;
        if !ports.riot_session.is_logged_in().await {
            ports.sink.emit_line(LogLevel::Info, "waiting for the restored session to finish signing in");
            if !run_workflow::wait_for_riot_login(ports, stop).await? {
                return Err(AppError::RiotClient(
                    "restored the session but the riot client never finished signing in. try signing in fresh for this account".into(),
                ));
            }
        }
        ports.sink.emit_line(LogLevel::Ok, &format!("restored the saved session and logged in to {}", account.label));
        return Ok(());
    }

    sessions.clear_active_session()?;
    ports.sink.emit_line(LogLevel::Info, "opening the riot client...");
    run_workflow::ensure_riot_running(ports, stop).await?;

    if stop.load(Ordering::Relaxed) {
        return Err(AppError::Cancelled);
    }

    let pid = ports
        .riot_runtime
        .running_pid()
        .await
        .ok_or(AppError::RiotClient(RiotClientError::NotRunning))?;
    let password = accounts.password(account_id)?;
    let username = account.username.clone();
    ports.sink.emit_line(LogLevel::Info, "filling in login details...");
    tokio::task::block_in_place(|| riot_login.login(pid, &username, &password, &*ports.sink, stop.as_ref()))?;

    run_workflow::check_cancelled(stop)?;

    ports.riot_session.enable_stay_signed_in().await?;
    run_workflow::check_cancelled(stop)?;
    run_workflow::wait_for_riot_to_settle(ports, stop).await?;
    if !ports.riot_session.is_logged_in().await {
        ports.sink.emit_line(LogLevel::Info, "waiting for the riot client to finish signing in");
        if !run_workflow::wait_for_riot_login(ports, stop).await? {
            return Err(AppError::RiotClient(
                "filled in the login details but the riot client never finished signing in. try again".into(),
            ));
        }
    }
    sessions.save(account_id, install_dir.as_deref(), &*ports.sink)?;
    ports.sink.emit_line(LogLevel::Ok, &format!("signed in fresh and logged in to {}", account.label));
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::sync::atomic::AtomicBool;
    use std::sync::{Arc, Mutex};

    use super::*;
    use crate::application::test_support::{fake_ports, FakeAccountStore, FakeProcesses, FakeRiot, FakeRiotLogin, FakeSessionSnapshotStore, Recorder};
    use crate::domain::Account;

    fn one_account_store() -> FakeAccountStore {
        FakeAccountStore {
            accounts  : Mutex::new(vec![Account { id: "1".into(), label: "Main".into(), username: "forgotmyseed".into(), notes: None, full_access: true, category: None, region: None }]),
            passwords : Mutex::new(HashMap::from([("1".to_string(), "secret".to_string())])),
        }
    }

    #[tokio::test]
    async fn cancelling_before_login_stops_immediately_without_automating_anything() {
        let recorder   = Arc::new(Recorder::default());
        let processes  = Arc::new(FakeProcesses { running: Default::default() });
        let riot       = Arc::new(FakeRiot { running: Mutex::new(true) });
        let ports      = fake_ports(recorder, processes, riot);
        let stop       = Arc::new(AtomicBool::new(true));
        let accounts   = one_account_store();
        let sessions   = FakeSessionSnapshotStore::default();
        let riot_login = FakeRiotLogin { calls: Mutex::new(Vec::new()) };

        let result = login("1", &accounts, &sessions, &riot_login, &ports, &stop).await;

        assert!(matches!(result, Err(AppError::Cancelled)));
        assert!(riot_login.calls.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn errors_when_the_account_no_longer_exists() {
        let recorder   = Arc::new(Recorder::default());
        let processes  = Arc::new(FakeProcesses { running: Default::default() });
        let riot       = Arc::new(FakeRiot { running: Mutex::new(true) });
        let ports      = fake_ports(recorder, processes, riot);
        let stop       = Arc::new(AtomicBool::new(false));
        let accounts   = FakeAccountStore { accounts: Mutex::new(Vec::new()), passwords: Mutex::new(HashMap::new()) };
        let sessions   = FakeSessionSnapshotStore::default();
        let riot_login = FakeRiotLogin { calls: Mutex::new(Vec::new()) };

        let result = login("missing", &accounts, &sessions, &riot_login, &ports, &stop).await;

        assert!(matches!(result, Err(AppError::Account(_))));
    }

    #[tokio::test]
    async fn restores_a_saved_session_instead_of_automating_login() {
        let recorder   = Arc::new(Recorder::default());
        let processes  = Arc::new(FakeProcesses { running: Default::default() });
        let riot       = Arc::new(FakeRiot { running: Mutex::new(true) });
        let ports      = fake_ports(recorder, processes, riot);
        let stop       = Arc::new(AtomicBool::new(false));
        let accounts   = one_account_store();
        let sessions   = FakeSessionSnapshotStore { has_snapshot: Mutex::new(true), ..Default::default() };
        let riot_login = FakeRiotLogin { calls: Mutex::new(Vec::new()) };

        login("1", &accounts, &sessions, &riot_login, &ports, &stop).await.unwrap();

        assert!(riot_login.calls.lock().unwrap().is_empty());
        assert!(*sessions.restored.lock().unwrap());
        assert!(!*sessions.cleared.lock().unwrap());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn automates_login_and_saves_a_snapshot_when_none_exists_yet() {
        let recorder   = Arc::new(Recorder::default());
        let processes  = Arc::new(FakeProcesses { running: Default::default() });
        let riot       = Arc::new(FakeRiot { running: Mutex::new(true) });
        let ports      = fake_ports(recorder, processes, riot);
        let stop       = Arc::new(AtomicBool::new(false));
        let accounts   = one_account_store();
        let sessions   = FakeSessionSnapshotStore::default();
        let riot_login = FakeRiotLogin { calls: Mutex::new(Vec::new()) };

        login("1", &accounts, &sessions, &riot_login, &ports, &stop).await.unwrap();

        assert_eq!(riot_login.calls.lock().unwrap().len(), 1);
        assert!(*sessions.cleared.lock().unwrap());
        assert!(*sessions.saved.lock().unwrap());
        assert!(!*sessions.restored.lock().unwrap());
    }
}
