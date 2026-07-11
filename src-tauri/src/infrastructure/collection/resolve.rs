use std::collections::{HashMap, HashSet};

use crate::dto::{CollectionCategoryCountsDto, CollectionItemDto, CollectionSkinVariantDto, CollectionWeaponDto};

use super::constants::{CAT_GUN_BUDDIES, CAT_PLAYER_CARDS, CAT_SPRAYS, CAT_TITLES, CAT_WEAPON_SKINS};
use super::types::{CatalogEntry, ContentLookup};

struct SkinGroup {
    dto              : CollectionItemDto,
    owned_member_ids : HashSet<String>,
}

pub(crate) fn resolve_items(owned: &[(String, String)], lookup: &ContentLookup) -> Vec<CollectionItemDto> {
    let mut seen = HashSet::new();
    let mut skin_groups: HashMap<String, SkinGroup> = HashMap::new();
    let mut buddy_groups: HashMap<String, CollectionItemDto> = HashMap::new();
    let mut spray_groups: HashMap<String, CollectionItemDto> = HashMap::new();
    let mut items = Vec::new();

    for (item_id, category) in owned {
        if !seen.insert(item_id.clone()) {
            continue;
        }
        let resolved = lookup.get(item_id);
        let dto = build_item_dto(item_id, category, resolved);

        match dto.category.as_str() {
            CAT_WEAPON_SKINS => {
                let skin_key = dto.skin_id.clone().unwrap_or_else(|| dto.id.clone());
                let member_id = item_id.to_lowercase();
                skin_groups
                    .entry(skin_key)
                    .and_modify(|group| {
                        merge_item_details(&mut group.dto, &dto);
                        group.owned_member_ids.insert(member_id.clone());
                    })
                    .or_insert_with(|| SkinGroup {
                        dto,
                        owned_member_ids: HashSet::from([member_id]),
                    });
            }
            CAT_GUN_BUDDIES => {
                let group_key = resolved
                    .and_then(|entry| entry.group_id.clone())
                    .unwrap_or_else(|| dto.id.clone());
                buddy_groups
                    .entry(group_key)
                    .and_modify(|existing| merge_item_details(existing, &dto))
                    .or_insert(dto);
            }
            CAT_SPRAYS => {
                let group_key = resolved
                    .and_then(|entry| entry.group_id.clone())
                    .unwrap_or_else(|| dto.id.clone());
                spray_groups
                    .entry(group_key)
                    .and_modify(|existing| merge_item_details(existing, &dto))
                    .or_insert(dto);
            }
            _ => items.push(dto),
        }
    }

    for (item_id, entry) in lookup {
        if !entry.is_default {
            continue;
        }
        match entry.category.as_str() {
            CAT_PLAYER_CARDS if seen.insert(item_id.clone()) => {
                items.push(build_item_dto(item_id, CAT_PLAYER_CARDS, Some(entry)));
            }
            CAT_SPRAYS => {
                let group_key = entry.group_id.clone().unwrap_or_else(|| item_id.clone());
                spray_groups
                    .entry(group_key)
                    .or_insert_with(|| build_item_dto(item_id, CAT_SPRAYS, Some(entry)));
            }
            _ => {}
        }
    }

    for (skin_key, mut group) in skin_groups {
        group.dto.variants = build_skin_variants(&skin_key, &group.owned_member_ids, lookup);
        items.push(group.dto);
    }
    items.extend(buddy_groups.into_values());
    items.extend(spray_groups.into_values());
    items.sort_by_key(|item| item.name.to_lowercase());
    items
}

pub(crate) fn attach_weapon_ids_by_skin_name(
    items: &mut [CollectionItemDto],
    weapons: &[CollectionWeaponDto],
) {
    let mut names: Vec<(String, String)> = weapons
        .iter()
        .map(|weapon| (weapon.name.to_lowercase(), weapon.id.clone()))
        .collect();
    names.sort_by(|left, right| right.0.len().cmp(&left.0.len()));

    for item in items.iter_mut() {
        if item.category != CAT_WEAPON_SKINS || item.weapon_id.is_some() {
            continue;
        }
        if item.name.is_empty() || item.name == "Unknown item" {
            continue;
        }
        let skin_name = item.name.to_lowercase();
        for (weapon_name, weapon_id) in &names {
            if skin_name == *weapon_name || skin_name.ends_with(&format!(" {weapon_name}")) {
                item.weapon_id = Some(weapon_id.clone());
                break;
            }
        }
    }
}

fn build_item_dto(item_id: &str, category: &str, resolved: Option<&CatalogEntry>) -> CollectionItemDto {
    let name = resolved
        .map(|entry| entry.name.clone())
        .unwrap_or_else(|| "Unknown item".to_string());
    let icon_url = resolved.and_then(|entry| entry.icon_url.clone());
    let preview_url = resolved.and_then(|entry| entry.preview_url.clone());
    let resolved_category = resolved.map(|entry| entry.category.clone()).unwrap_or_else(|| category.to_string());

    CollectionItemDto {
        id: item_id.to_string(),
        name,
        icon_url,
        preview_url,
        category: resolved_category,
        weapon_id: resolved.and_then(|entry| entry.weapon_id.clone()),
        skin_id: resolved.and_then(|entry| entry.skin_id.clone()),
        content_tier_uuid: resolved.and_then(|entry| entry.content_tier_uuid.clone()),
        is_default: resolved.map(|entry| entry.is_default).unwrap_or(false),
        variants: Vec::new(),
    }
}

fn build_skin_variants(
    skin_key: &str,
    owned_member_ids: &HashSet<String>,
    lookup: &ContentLookup,
) -> Vec<CollectionSkinVariantDto> {
    let skin_key_lower = skin_key.to_lowercase();
    let group_owned = !owned_member_ids.is_empty();
    let mut variants: Vec<CollectionSkinVariantDto> = lookup
        .iter()
        .filter(|(id, entry)| {
            entry.category == CAT_WEAPON_SKINS
                && entry.skin_id.as_deref().map(str::to_lowercase).as_deref() == Some(skin_key_lower.as_str())
                && id.as_str() != skin_key_lower.as_str()
                && !entry.is_level
        })
        .map(|(id, entry)| {
            let id_lower = id.to_lowercase();
            let is_default_chroma = !entry.name.contains('(');
            let owned = owned_member_ids.contains(&id_lower) || (is_default_chroma && group_owned);
            CollectionSkinVariantDto {
                id           : id_lower,
                display_name : entry.name.clone(),
                icon_url     : entry.icon_url.clone(),
                preview_url  : entry.preview_url.clone(),
                swatch_url   : entry.swatch_url.clone(),
                video_url    : entry.video_url.clone(),
                owned,
            }
        })
        .collect();

    variants.sort_by(|left, right| {
        left.display_name
            .to_lowercase()
            .cmp(&right.display_name.to_lowercase())
            .then_with(|| left.id.cmp(&right.id))
    });
    variants
}

fn merge_item_details(existing: &mut CollectionItemDto, incoming: &CollectionItemDto) {
    if existing.preview_url.is_none() {
        existing.preview_url = incoming.preview_url.clone();
    }
    if existing.icon_url.is_none() {
        existing.icon_url = incoming.icon_url.clone();
    }
    if existing.content_tier_uuid.is_none() {
        existing.content_tier_uuid = incoming.content_tier_uuid.clone();
    }
    if existing.weapon_id.is_none() {
        existing.weapon_id = incoming.weapon_id.clone();
    }
    if existing.skin_id.is_none() {
        existing.skin_id = incoming.skin_id.clone();
    }
    if existing.name == "Unknown item" && incoming.name != "Unknown item" {
        existing.name = incoming.name.clone();
    }
    if existing.is_default && !incoming.is_default {
        existing.is_default = false;
    }
}

pub(crate) fn count_by_category(items: &[CollectionItemDto]) -> CollectionCategoryCountsDto {
    let mut counts = CollectionCategoryCountsDto::default();
    for item in items {
        match item.category.as_str() {
            CAT_WEAPON_SKINS => counts.weapon_skins += 1,
            CAT_GUN_BUDDIES => counts.gun_buddies += 1,
            CAT_PLAYER_CARDS => counts.player_cards += 1,
            CAT_SPRAYS => counts.sprays += 1,
            CAT_TITLES => counts.titles += 1,
            _ => {}
        }
    }
    counts
}

pub(crate) fn catalog_totals(lookup: &ContentLookup) -> CollectionCategoryCountsDto {
    let mut totals = CollectionCategoryCountsDto::default();
    let mut seen_skins = HashSet::new();
    let mut seen_buddies = HashSet::new();
    let mut seen_sprays = HashSet::new();

    for (item_id, entry) in lookup {
        match entry.category.as_str() {
            CAT_WEAPON_SKINS => {
                if entry.is_default {
                    continue;
                }
                let key = entry.skin_id.as_deref().unwrap_or(item_id.as_str()).to_string();
                if seen_skins.insert(key) {
                    totals.weapon_skins += 1;
                }
            }
            CAT_GUN_BUDDIES => {
                let key = entry.group_id.as_deref().unwrap_or(item_id.as_str()).to_string();
                if seen_buddies.insert(key) {
                    totals.gun_buddies += 1;
                }
            }
            CAT_PLAYER_CARDS => totals.player_cards += 1,
            CAT_SPRAYS => {
                let key = entry.group_id.as_deref().unwrap_or(item_id.as_str()).to_string();
                if seen_sprays.insert(key) {
                    totals.sprays += 1;
                }
            }
            CAT_TITLES => totals.titles += 1,
            _ => {}
        }
    }

    totals
}
