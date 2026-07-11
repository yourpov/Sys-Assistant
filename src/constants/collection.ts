import type { CollectionCategory } from '../types';

export const COLLECTION_CATEGORIES: readonly CollectionCategory[] = [
  'weapon_skins',
  'gun_buddies',
  'player_cards',
  'sprays',
  'titles',
];

export const COLLECTION_CATEGORY_LABELS: Record<CollectionCategory, string> = {
  weapon_skins : 'Weapon Skins',
  gun_buddies  : 'Gun Buddies',
  player_cards : 'Player Cards',
  sprays       : 'Sprays',
  titles       : 'Titles',
};

export const COLLECTION_CATEGORY_HINTS: Record<CollectionCategory, string> = {
  weapon_skins : 'Weapon skins on this account',
  gun_buddies  : 'Gun buddies on this account',
  player_cards : 'Player cards on this account',
  sprays       : 'Sprays on this account',
  titles       : 'Titles on this account',
};

export const COLLECTION_SORT_ASC_HINT  = 'Sort owned items A to Z';
export const COLLECTION_SORT_DESC_HINT = 'Sort owned items Z to A';
export const COLLECTION_REFRESH_HINT        = 'Reload owned items and cosmetics';
export const COLLECTION_OPEN_RIOT_WAIT_HINT = 'Riot Client is open. Sign in, then Collection will refresh automatically.';

export function isCollectionCategory(value: string): value is CollectionCategory {
  return (COLLECTION_CATEGORIES as readonly string[]).includes(value);
}