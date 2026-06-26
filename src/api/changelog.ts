import { invoke } from '@tauri-apps/api/core';

export function fetchChangelog(): Promise<string> {
  return invoke('fetch_changelog');
}
