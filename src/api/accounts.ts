import { invoke } from '@tauri-apps/api/core';

import type { Account } from '../types';

export function listAccounts(): Promise<Account[]> {
  return invoke('list_accounts');
}

export function addAccount(label: string, username: string, password: string): Promise<Account> {
  return invoke('add_account', { label, username, password });
}

export function updateAccount(id: string, label: string, username: string, password: string | null): Promise<void> {
  return invoke('update_account', { id, label, username, password });
}

export function removeAccount(id: string): Promise<void> {
  return invoke('remove_account', { id });
}

export function loginAccount(id: string): Promise<void> {
  return invoke('login_account', { id });
}

export function forgetAccountSession(id: string): Promise<void> {
  return invoke('forget_account_session', { id });
}
