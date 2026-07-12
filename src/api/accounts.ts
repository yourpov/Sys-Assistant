import { invoke } from '@tauri-apps/api/core';

import type { Account }                                    from '../types';
import type { ExportAccountsResult, ImportAccountsResult } from '../utils/accountTxt';

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

export function setAccountNotes(id: string, notes: string | null): Promise<void> {
  return invoke('set_account_notes', { id, notes });
}

export function setAccountFullAccess(id: string, fullAccess: boolean): Promise<void> {
  return invoke('set_account_full_access', { id, fullAccess });
}

export function setAccountCategory(id: string, category: string | null): Promise<void> {
  return invoke('set_account_category', { id, category });
}

export function setAccountRegion(id: string, region: string | null): Promise<void> {
  return invoke('set_account_region', { id, region });
}

export function reorderAccounts(ids: string[]): Promise<void> {
  return invoke('reorder_accounts', { ids });
}

export function loginAccount(id: string): Promise<void> {
  return invoke('login_account', { id });
}

export function forgetAccountSession(id: string): Promise<void> {
  return invoke('forget_account_session', { id });
}

export function exportAccountsTxt(path: string): Promise<ExportAccountsResult> {
  return invoke('export_accounts_txt', { path });
}

export function importAccountsTxt(path: string): Promise<ImportAccountsResult> {
  return invoke('import_accounts_txt', { path });
}
