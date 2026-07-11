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