import { invoke } from '@tauri-apps/api/core';

import type { AccountLookup, MatchInfo } from '../types';

export function lookupAccount(name: string, tag: string): Promise<AccountLookup> {
  return invoke('lookup_account', { name, tag });
}

export function fetchMatchInfo(): Promise<MatchInfo> {
  return invoke('fetch_match_info');
}
