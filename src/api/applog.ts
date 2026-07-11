import { invoke } from '@tauri-apps/api/core';

import type { LogLevel } from '../types';

export function readAppLog(): Promise<string> {
  return invoke('read_app_log');
}

export function clearAppLog(): Promise<void> {
  return invoke('clear_app_log');
}

export function appendAppLog(level: LogLevel, message: string): Promise<void> {
  return invoke('append_app_log', { level, message });
}
