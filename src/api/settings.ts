import { invoke } from '@tauri-apps/api/core';

import type { Settings } from '../types';

export function getSettings(): Promise<Settings> {
  return invoke('get_settings');
}

export function saveSettings(settings: Settings): Promise<void> {
  return invoke('save_settings', { settings });
}

export function findFilePath(filename: string): Promise<string | null> {
  return invoke('find_file_path', { filename });
}
