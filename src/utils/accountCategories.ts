import type { Account } from '../types';

export const UNCATEGORIZED_KEY   = '';
export const UNCATEGORIZED_LABEL = 'Uncategorized';

export interface AccountCategoryGroup {
  key      : string;
  title    : string;
  accounts : Account[];
}

function categoryKeyOf(category: string | null): string {
  return (category ?? '').trim().toLowerCase();
}

export function groupAccountsByCategory(accounts: Account[]): AccountCategoryGroup[] {
  const byKey = new Map<string, AccountCategoryGroup>();
  for (const account of accounts) {
    const key = categoryKeyOf(account.category);
    let group = byKey.get(key);
    if (!group) {
      const title = key === UNCATEGORIZED_KEY ? UNCATEGORIZED_LABEL : (account.category ?? '').trim();
      group = { key, title, accounts: [] };
      byKey.set(key, group);
    }
    group.accounts.push(account);
  }
  const groups = [...byKey.values()];
  const categorized   = groups.filter((group) => group.key !== UNCATEGORIZED_KEY);
  const uncategorized = groups.filter((group) => group.key === UNCATEGORIZED_KEY);
  return [...categorized, ...uncategorized];
}

export function distinctCategories(accounts: Account[]): string[] {
  const set = new Set<string>();
  for (const account of accounts) {
    const trimmed = (account.category ?? '').trim();
    if (trimmed !== '') set.add(trimmed);
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
