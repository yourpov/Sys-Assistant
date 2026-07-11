import type {
  CollectionCategory,
  CollectionCategoryCounts,
  CollectionItem,
  CollectionSkinVariant,
  CollectionWeapon,
} from '../types';

export function sumCollectionCounts(counts: CollectionCategoryCounts): number {
  return counts.weaponSkins + counts.gunBuddies + counts.playerCards + counts.sprays + counts.titles;
}

export function formatOwnedTotal(owned: number, total: number): string {
  return `${owned.toLocaleString()} / ${total.toLocaleString()}`;
}

export function formatSkinProgress(owned: number, total: number): string {
  if (total <= 0) return owned.toLocaleString();
  return formatOwnedTotal(owned, total);
}

export function weaponTooltip(weapon: CollectionWeapon, owned: number): string {
  const skins = formatSkinProgress(owned, weapon.totalSkinCount);
  return `${weapon.name}\n${weapon.weaponClass}\n${skins} skins owned`;
}

export interface CollectionSkinOption {
  key            : string;
  skinId         : string;
  name           : string;
  iconUrl        : string | null;
  previewUrl     : string | null;
  contentTierUuid: string | null;
  isDefault      : boolean;
  owned          : boolean;
  variants       : CollectionSkinVariant[];
}

export function buildWeaponSkinOptions(
weapon    : CollectionWeapon,
ownedSkins: CollectionItem[],
)         : CollectionSkinOption[] {
  const bySkinId = new Map<string, CollectionItem>();
  for (const item of ownedSkins) {
    const skinId = item.skinId ?? item.id;
    if (!bySkinId.has(skinId)) {
      bySkinId.set(skinId, item);
    }
  }

  const defaultOption: CollectionSkinOption = {
    key            : `default-${weapon.defaultSkinId}`,
    skinId         : weapon.defaultSkinId,
    name           : weapon.defaultSkinName,
    iconUrl        : weapon.defaultSkinPreviewUrl ?? weapon.defaultSkinIconUrl ?? weapon.iconUrl,
    previewUrl     : weapon.defaultSkinPreviewUrl ?? weapon.defaultSkinIconUrl ?? weapon.iconUrl,
    contentTierUuid: null,
    isDefault      : true,
    owned          : true,
    variants       : [],
  };

  const defaultId = weapon.defaultSkinId.toLowerCase();
  const ownedOptions = [...bySkinId.values()]
    .filter((item) => (item.skinId ?? item.id).toLowerCase() !== defaultId)
    .map((item) => ({
      key            : item.skinId ?? item.id,
      skinId         : item.skinId ?? item.id,
      name           : item.name,
      iconUrl        : item.iconUrl,
      previewUrl     : item.previewUrl,
      contentTierUuid: item.contentTierUuid,
      isDefault      : item.isDefault,
      owned          : true,
      variants       : item.variants ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return [defaultOption, ...ownedOptions];
}

export function variantTileImage(variant: CollectionSkinVariant): string | null {
  return variant.swatchUrl ?? variant.iconUrl ?? variant.previewUrl;
}

export function variantPreviewImage(variant: CollectionSkinVariant): string | null {
  return variant.previewUrl ?? variant.iconUrl ?? variant.swatchUrl;
}

export function filterCollectionItems(
items   : CollectionItem[],
category: CollectionCategory,
query   : string,
)       : CollectionItem[] {
  const normalized = query.trim().toLowerCase();
  let   filtered   = items.filter((item) => item.category === category);

  if (normalized) {
    filtered = filtered.filter((item) => item.name.toLowerCase().includes(normalized));
  }

  return [...filtered].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function skinNameMatchesWeapon(skinName: string, weaponName: string): boolean {
  const skin = skinName.trim().toLowerCase();
  const weapon = weaponName.trim().toLowerCase();
  if (!skin || !weapon) return false;
  return skin === weapon || skin.endsWith(` ${weapon}`);
}

export function ownedSkinsForWeapon(items: CollectionItem[], weapon: CollectionWeapon): CollectionItem[] {
  const wantId = weapon.id.toLowerCase();
  const matched = new Map<string, CollectionItem>();

  for (const item of items) {
    if (item.category !== 'weapon_skins') continue;

    const itemWeapon = item.weaponId?.toLowerCase() ?? null;
    const key = (item.skinId ?? item.id).toLowerCase();

    if (itemWeapon != null && itemWeapon === wantId) {
      matched.set(key, item);
      continue;
    }

    if (itemWeapon != null && itemWeapon !== wantId) continue;
    if (!skinNameMatchesWeapon(item.name, weapon.name)) continue;
    if (!matched.has(key)) matched.set(key, item);
  }

  return [...matched.values()];
}

export function ownedSkinCountForWeapon(items: CollectionItem[], weapon: CollectionWeapon): number {
  const owned = ownedSkinsForWeapon(items, weapon);
  const unique = new Set(owned.map((item) => item.skinId ?? item.id));
  return unique.size;
}

export interface WeaponStatRow {
  label: string;
  value: string;
}

export function weaponStatRows(weapon: CollectionWeapon): WeaponStatRow[] {
  const rows: WeaponStatRow[] = [];

  if (weapon.fireRate !== null) {
    rows.push({ label : 'Fire rate', value : `${weapon.fireRate}/s` });
  }
  if (weapon.magazineSize !== null) {
    rows.push({ label : 'Magazine', value : String(weapon.magazineSize) });
  }
  if (weapon.reloadTimeSeconds !== null) {
    rows.push({ label : 'Reload', value : `${weapon.reloadTimeSeconds.toFixed(1)}s` });
  }
  if (weapon.equipTimeSeconds !== null) {
    rows.push({ label : 'Equip', value : `${weapon.equipTimeSeconds.toFixed(1)}s` });
  }
  if (weapon.bodyDamage !== null) {
    rows.push({ label : 'Body dmg', value : String(weapon.bodyDamage) });
  }
  if (weapon.headDamage !== null) {
    rows.push({ label : 'Head dmg', value : String(weapon.headDamage) });
  }
  if (weapon.wallPenetration) {
    rows.push({ label : 'Penetration', value : weapon.wallPenetration });
  }
  if (weapon.shopCost !== null) {
    rows.push({ label : 'Cost', value : weapon.shopCost.toLocaleString() });
  }

  return rows;
}

export function previewImage(item: Pick<CollectionItem, 'previewUrl' | 'iconUrl'> | CollectionSkinOption): string | null {
  return item.previewUrl ?? item.iconUrl;
}

export function playerCardTileImage(item: Pick<CollectionItem, 'previewUrl' | 'iconUrl'>): string | null {
  return item.iconUrl ?? item.previewUrl;
}

export function playerCardDetailImage(item: Pick<CollectionItem, 'previewUrl' | 'iconUrl'>): string | null {
  return item.previewUrl ?? item.iconUrl;
}

export function buddyDetailImage(item: Pick<CollectionItem, 'previewUrl' | 'iconUrl'>): string | null {
  return item.previewUrl ?? item.iconUrl;
}