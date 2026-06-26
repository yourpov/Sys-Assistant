import { invoke } from '@tauri-apps/api/core';

import type { AppCredit } from '../types';

export function getAppCredit(): Promise<AppCredit> {
  return invoke('get_app_credit');
}
