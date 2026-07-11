import { invoke } from '@tauri-apps/api/core';

import type {
  CollectionItem,
  CollectionSkinVariant,
  CollectionSnapshot,
  CollectionWeapon,
  RiotClientStatus,
} from '../types';

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as LooseRecord)
    : null;
}

function pickString(record: LooseRecord, camel: string, snake: string): string | null {
  const value = record[camel] ?? record[snake];
  return typeof value === 'string' ? value : null;
}

function pickNumber(record: LooseRecord, camel: string, snake: string): number | null {
  const value = record[camel] ?? record[snake];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pickBool(record: LooseRecord, camel: string, snake: string, fallback = false): boolean {
  const value = record[camel] ?? record[snake];
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeVariant(raw: unknown): CollectionSkinVariant | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = pickString(record, 'id', 'id');
  if (!id) return null;
  return {
    id,
    displayName : pickString(record, 'displayName', 'display_name') ?? id,
    iconUrl     : pickString(record, 'iconUrl', 'icon_url'),
    previewUrl  : pickString(record, 'previewUrl', 'preview_url'),
    swatchUrl   : pickString(record, 'swatchUrl', 'swatch_url'),
    videoUrl    : pickString(record, 'videoUrl', 'video_url'),
    owned       : pickBool(record, 'owned', 'owned'),
  };
}

function normalizeItem(raw: unknown): CollectionItem | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = pickString(record, 'id', 'id');
  const name = pickString(record, 'name', 'name');
  const category = pickString(record, 'category', 'category');
  if (!id || !name || !category) return null;

  const variantsRaw = record.variants;
  const variants = Array.isArray(variantsRaw)
    ? variantsRaw.map(normalizeVariant).filter((variant): variant is CollectionSkinVariant => variant !== null)
    : [];

  return {
    id,
    name,
    iconUrl          : pickString(record, 'iconUrl', 'icon_url'),
    previewUrl       : pickString(record, 'previewUrl', 'preview_url'),
    category,
    weaponId         : pickString(record, 'weaponId', 'weapon_id'),
    skinId           : pickString(record, 'skinId', 'skin_id'),
    contentTierUuid  : pickString(record, 'contentTierUuid', 'content_tier_uuid'),
    isDefault        : pickBool(record, 'isDefault', 'is_default'),
    variants,
  };
}

function normalizeWeapon(raw: unknown): CollectionWeapon | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = pickString(record, 'id', 'id');
  const name = pickString(record, 'name', 'name');
  const defaultSkinId = pickString(record, 'defaultSkinId', 'default_skin_id');
  const defaultSkinName = pickString(record, 'defaultSkinName', 'default_skin_name');
  const weaponClass = pickString(record, 'weaponClass', 'weapon_class');
  if (!id || !name || !defaultSkinId || !defaultSkinName || !weaponClass) return null;

  return {
    id,
    name,
    iconUrl              : pickString(record, 'iconUrl', 'icon_url'),
    defaultSkinId,
    defaultSkinName,
    defaultSkinIconUrl   : pickString(record, 'defaultSkinIconUrl', 'default_skin_icon_url'),
    defaultSkinPreviewUrl: pickString(record, 'defaultSkinPreviewUrl', 'default_skin_preview_url'),
    weaponClass,
    sortOrder            : pickNumber(record, 'sortOrder', 'sort_order') ?? 0,
    fireRate             : pickNumber(record, 'fireRate', 'fire_rate'),
    magazineSize         : pickNumber(record, 'magazineSize', 'magazine_size'),
    reloadTimeSeconds    : pickNumber(record, 'reloadTimeSeconds', 'reload_time_seconds'),
    equipTimeSeconds     : pickNumber(record, 'equipTimeSeconds', 'equip_time_seconds'),
    wallPenetration      : pickString(record, 'wallPenetration', 'wall_penetration'),
    headDamage           : pickNumber(record, 'headDamage', 'head_damage'),
    bodyDamage           : pickNumber(record, 'bodyDamage', 'body_damage'),
    shopCost             : pickNumber(record, 'shopCost', 'shop_cost'),
    totalSkinCount       : pickNumber(record, 'totalSkinCount', 'total_skin_count') ?? 0,
  };
}

function normalizeCounts(raw: unknown) {
  const record = asRecord(raw) ?? {};
  return {
    weaponSkins : pickNumber(record, 'weaponSkins', 'weapon_skins') ?? 0,
    gunBuddies  : pickNumber(record, 'gunBuddies', 'gun_buddies') ?? 0,
    playerCards : pickNumber(record, 'playerCards', 'player_cards') ?? 0,
    sprays      : pickNumber(record, 'sprays', 'sprays') ?? 0,
    titles      : pickNumber(record, 'titles', 'titles') ?? 0,
  };
}

export function normalizeSnapshot(raw: unknown): CollectionSnapshot {
  const record = asRecord(raw) ?? {};
  const weaponsRaw = record.weapons;
  const itemsRaw = record.items;

  return {
    accountName    : pickString(record, 'accountName', 'account_name'),
    accountTag     : pickString(record, 'accountTag', 'account_tag'),
    weapons        : Array.isArray(weaponsRaw)
      ? weaponsRaw.map(normalizeWeapon).filter((weapon): weapon is CollectionWeapon => weapon !== null)
      : [],
    items          : Array.isArray(itemsRaw)
      ? itemsRaw.map(normalizeItem).filter((item): item is CollectionItem => item !== null)
      : [],
    counts         : normalizeCounts(record.counts),
    totals         : normalizeCounts(record.totals),
    catalogLoaded  : pickBool(record, 'catalogLoaded', 'catalog_loaded'),
    catalogWarning : pickString(record, 'catalogWarning', 'catalog_warning'),
    sessionWarning : pickString(record, 'sessionWarning', 'session_warning'),
  };
}

export async function fetchCollection(): Promise<CollectionSnapshot> {
  const raw = await invoke<unknown>('fetch_collection');
  return normalizeSnapshot(raw);
}

export function getRiotClientStatus(): Promise<RiotClientStatus> {
  return invoke('get_riot_client_status');
}

export function openRiotClient(): Promise<void> {
  return invoke('open_riot_client');
}
