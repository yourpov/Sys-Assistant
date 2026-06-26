import { AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

import { addAccount, forgetAccountSession, listAccounts, loginAccount, removeAccount, updateAccount } from '../api/accounts';
import { onWorkflowLog } from '../api/events';
import { cancelAction } from '../api/workflow';
import { useMouseGlow } from '../hooks/useMouseGlow';
import type { Account, LogLine } from '../types';
import { AccountFormDialog } from './AccountFormDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { LogPanel } from './LogPanel';
import { Skeleton } from './Skeleton';

interface Props {
  onLookup: (riotId: string) => void;
}

export function AccountsPage({ onLookup }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [forgettingId, setForgettingId] = useState<string | null>(null);
  const [loggingInId, setLoggingInId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const glowRef = useMouseGlow<HTMLElement>();

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .catch((e) => log('error', `couldn't load accounts (${e})`))
      .finally(() => setLoadingAccounts(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    onWorkflowLog((line) => setLines((prev) => [...prev, line])).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const log = (level: LogLine['level'], message: string) => {
    setLines((prev) => [...prev, { level, message }]);
  };

  const login = async (account: Account) => {
    setLines([]);
    setLoggingInId(account.id);
    try {
      await loginAccount(account.id);
    } catch {
    } finally {
      setLoggingInId(null);
    }
  };

  const cancelLogin = () => {
    void cancelAction();
  };

  const copyLabel = async (account: Account) => {
    await navigator.clipboard.writeText(account.label);
    setCopiedId(account.id);
    setTimeout(() => setCopiedId((current) => (current === account.id ? null : current)), 1200);
  };

  const confirmRemove = async () => {
    if (!removingAccount) return;
    try {
      await removeAccount(removingAccount.id);
      setAccounts((prev) => prev.filter((account) => account.id !== removingAccount.id));
      log('ok', `removed ${removingAccount.label}`);
      setRemovingId(null);
    } catch (e) {
      log('error', String(e));
      setRemovingId(null);
    }
  };

  const confirmForget = async () => {
    if (!forgettingAccount) return;
    try {
      await forgetAccountSession(forgettingAccount.id);
      setAccounts((prev) => prev.map((account) => (account.id === forgettingAccount.id ? { ...account, hasSession: false } : account)));
      log('ok', `forgot the saved session for ${forgettingAccount.label}`);
      setForgettingId(null);
    } catch (e) {
      log('error', String(e));
      setForgettingId(null);
    }
  };

  const submitAdd = async (label: string, username: string, password: string) => {
    setSaving(true);
    setFormError(null);
    try {
      const account = await addAccount(label, username, password);
      setAccounts((prev) => [...prev, account]);
      log('ok', `added ${label}`);
      setAdding(false);
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (label: string, username: string, password: string) => {
    if (!editingId) return;
    setSaving(true);
    setFormError(null);
    try {
      await updateAccount(editingId, label, username, password === '' ? null : password);
      setAccounts((prev) => prev.map((account) => (account.id === editingId ? { ...account, label, username } : account)));
      log('ok', `updated ${label}`);
      setEditingId(null);
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const closeAdd = () => {
    setAdding(false);
    setFormError(null);
  };

  const closeEdit = () => {
    setEditingId(null);
    setFormError(null);
  };

  const clearLogs = () => setLines([]);

  const removingAccount = accounts.find((account) => account.id === removingId);
  const forgettingAccount = accounts.find((account) => account.id === forgettingId);
  const editingAccount = accounts.find((account) => account.id === editingId);
  const anyActionInProgress = loggingInId !== null;

  return (
    <main className="accounts-page" data-tauri-drag-region ref={glowRef}>
      <div className="account-controls" data-tauri-drag-region>
        {accounts.length > 0 && <p className="accounts-notice">Logging in closes your current Riot session.</p>}
        <div className="account-list" data-tauri-drag-region>
          {loadingAccounts &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="account-row" data-tauri-drag-region>
                <div className="account-row-text" data-tauri-drag-region>
                  <Skeleton width={120} height={13} />
                  <Skeleton width={80} height={11} />
                </div>
                <Skeleton width={64} height={26} />
              </div>
            ))}
          {accounts.map((account) => {
            const isLoggingIn = loggingInId === account.id;
            return (
              <div key={account.id} className="account-row" data-tauri-drag-region>
                <div className="account-row-text" data-tauri-drag-region>
                  <span
                    className="account-row-label account-row-label-copyable"
                    onClick={() => copyLabel(account)}
                    title="Click to copy"
                  >
                    {copiedId === account.id ? 'Copied!' : account.label}
                  </span>
                  <span className="account-row-username">{account.username}</span>
                </div>
                <div className="account-row-actions" data-tauri-drag-region>
                  <button
                    className="account-login-button"
                    disabled={anyActionInProgress}
                    onClick={() => login(account)}
                    title={account.hasSession ? 'Sign in with saved session' : 'Sign in fresh and save a session'}
                  >
                    {isLoggingIn ? 'Logging in...' : 'Login'}
                  </button>
                  {account.hasSession && (
                    <button
                      className="account-icon-button"
                      disabled={anyActionInProgress}
                      onClick={() => setForgettingId(account.id)}
                      aria-label={`Forget saved session for ${account.label}`}
                      title="Forget saved session"
                    >
                      <ForgetIcon />
                    </button>
                  )}
                  <button
                    className="account-lookup-button"
                    disabled={anyActionInProgress}
                    onClick={() => onLookup(account.label)}
                    title="Look up this account in Tools"
                  >
                    Lookup
                  </button>
                  <button
                    className="account-icon-button"
                    disabled={anyActionInProgress}
                    onClick={() => setEditingId(account.id)}
                    aria-label={`Edit ${account.label}`}
                    title="Edit account"
                  >
                    <EditIcon />
                  </button>
                  <button
                    className="account-icon-button account-remove-button"
                    disabled={anyActionInProgress}
                    onClick={() => setRemovingId(account.id)}
                    aria-label={`Remove ${account.label}`}
                    title="Remove account"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button
          className="add-account-button"
          disabled={anyActionInProgress}
          onClick={() => setAdding(true)}
          title="Add account"
        >
          + Add account
        </button>
        {anyActionInProgress && (
          <button className="cancel-button" onClick={cancelLogin} title="Cancel login">
            Cancel
          </button>
        )}
      </div>

      <LogPanel lines={lines} onClear={clearLogs} emptyMessage="Account activity will show up here." />

      <AnimatePresence>
        {adding && (
          <AccountFormDialog key="adding" mode="add" error={formError} saving={saving} onSave={submitAdd} onCancel={closeAdd} />
        )}
        {editingAccount && (
          <AccountFormDialog
            key="editing"
            mode="edit"
            initialLabel={editingAccount.label}
            initialUsername={editingAccount.username}
            error={formError}
            saving={saving}
            onSave={submitEdit}
            onCancel={closeEdit}
          />
        )}
        {removingAccount && (
          <ConfirmDialog
            key="removing"
            title={`Remove ${removingAccount.label}?`}
            body="This only removes it from this list. it won't sign you out of the Riot Client."
            confirmLabel="Remove"
            onConfirm={confirmRemove}
            onCancel={() => setRemovingId(null)}
            tone="danger"
          />
        )}
        {forgettingAccount && (
          <ConfirmDialog
            key="forgetting"
            title={`Forget saved session for ${forgettingAccount.label}?`}
            body="The account stays in your list. its next login will sign in fresh through the Riot Client and save a new session."
            confirmLabel="Forget session"
            onConfirm={confirmForget}
            onCancel={() => setForgettingId(null)}
            tone="warning"
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20l1.06-3.18a2 2 0 0 1 .5-.81L16.4 5.17a1.5 1.5 0 0 1 2.12 0l.31.31a1.5 1.5 0 0 1 0 2.12L8.99 18.44a2 2 0 0 1-.81.5L4 20z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ForgetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 4v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
