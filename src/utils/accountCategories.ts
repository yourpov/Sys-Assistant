import type { Account } from '../types';
import { ACCOUNT_REGIONS } from '../constants/accountRegions';

export const UNCATEGORIZED_KEY   = '';
export const UNCATEGORIZED_LABEL = 'Uncategorized';

export const NO_REGION_KEY   = '';
export const NO_REGION_LABEL = 'No region';

export type AccountGroupMode = 'category' | 'access' | 'region';

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

export function groupAccountsByAccess(accounts: Account[]): AccountCategoryGroup[] {
  const fa : AccountCategoryGroup = { key: 'fa',  title: 'Full Access',     accounts: [] };
  const nfa: AccountCategoryGroup = { key: 'nfa', title: 'Not Full Access', accounts: [] };
  for (const account of accounts) {
    (account.fullAccess ? fa : nfa).accounts.push(account);
  }
  return [fa, nfa];
}

export function groupAccountsByRegion(accounts: Account[]): AccountCategoryGroup[] {
  const byKey = new Map<string, AccountCategoryGroup>();
  for (const account of accounts) {
    const trimmed = (account.region ?? '').trim();
    const key     = trimmed.toLowerCase();
    let group     = byKey.get(key);
    if (!group) {
      const title = trimmed === '' ? NO_REGION_LABEL : trimmed;
      group = { key, title, accounts: [] };
      byKey.set(key, group);
    }
    group.accounts.push(account);
  }

  const order = new Map(ACCOUNT_REGIONS.map((region, index) => [region.toLowerCase(), index]));
  const rank  = (group: AccountCategoryGroup): number =>
    group.key === NO_REGION_KEY ? Number.MAX_SAFE_INTEGER : order.get(group.key) ?? ACCOUNT_REGIONS.length;

  return [...byKey.values()].sort((a, b) => {
    const diff = rank(a) - rank(b);
    return diff !== 0 ? diff : a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
}

export function groupAccounts(accounts: Account[], mode: AccountGroupMode): AccountCategoryGroup[] {
  switch (mode) {
    case 'access': return groupAccountsByAccess(accounts);
    case 'region': return groupAccountsByRegion(accounts);
    default      : return groupAccountsByCategory(accounts);
  }
}

export function distinctCategories(accounts: Account[]): string[] {
  const set = new Set<string>();
  for (const account of accounts) {
    const trimmed = (account.category ?? '').trim();
    if (trimmed !== '') set.add(trimmed);
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
