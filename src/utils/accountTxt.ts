import type { Account } from '../types';

export interface ImportAccountsResult {
  added            : Account[];
  skippedDuplicates: number;
  errors           : string[];
}

export interface ExportAccountsResult {
  exported: number;
  errors  : string[];
}

/**
 * 'credentials' → `user:pass | Display#Tag` lines only.
 * 'full'        → JSON with categories, region, FA/NFA, and notes so a re-import restores everything.
 */
export type AccountExportFormat = 'credentials' | 'full';