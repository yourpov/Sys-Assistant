import { invoke } from '@tauri-apps/api/core';

import type { AccountLookup, AccountLookupExtras, LiveMatchSnapshot, MatchInfo, ValorantVersionStatus } from '../types';

export function lookupAccount(name: string, tag: string): Promise<AccountLookup> {
  return invoke('lookup_account', { name, tag });
}

export function lookupAccountProfile(name: string, tag: string): Promise<AccountLookup> {
  return invoke('lookup_account_profile', { name, tag });
}

export function lookupAccountExtras(name: string, tag: string, region: string): Promise<AccountLookupExtras> {
  return invoke('lookup_account_extras', { name, tag, region });
}

export function fetchMatchInfo(phase?: 'roster' | 'ranks' | 'all'): Promise<MatchInfo> {
  return invoke('fetch_match_info', { phase: phase ?? 'all' });
}

export function detectCurrentAccount(): Promise<AccountLookup> {
  return invoke('detect_current_account');
}

export function detectCurrentAccountProfile(): Promise<AccountLookup> {
  return invoke('detect_current_account_profile');
}

export function fetchLiveMatchSnapshot(): Promise<LiveMatchSnapshot> {
  return invoke('fetch_live_match_snapshot');
}

export function fetchValorantVersionStatus(): Promise<ValorantVersionStatus> {
  return invoke('fetch_valorant_version_status');
}
