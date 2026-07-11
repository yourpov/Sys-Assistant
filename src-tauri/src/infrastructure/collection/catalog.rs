use std::collections::{HashMap, HashSet};

use serde::Deserialize;

use crate::dto::CollectionWeaponDto;
use crate::error::AppError;

use super::constants::{
    CAT_GUN_BUDDIES, CAT_PLAYER_CARDS, CAT_SPRAYS, CAT_TITLES, CAT_WEAPON_SKINS, DEFAULT_PLAYER_CARD_ID, DEFAULT_SPRAY_ID,
    GRID_ROW_MULTIPLIER, GRID_SORT_FALLBACK,
};
use super::types::{
    BuddyData, CardData, CatalogEntry, ContentBundle, ContentLookup, SkinChroma, SkinData, SkinLevel, SprayData, TitleData,
    ValorantApiResponse, WeaponData,
};

pub(crate) type SkinWeaponMap = HashMap<String, String>;

fn format_wall_penetration(raw: &str) -> String {
    raw.rsplit("::").next().unwrap_or(raw).to_string()
}

pub(crate) async fn fetch_remote_content_bundle() -> Result<ContentBundle, AppError> {
    let client = crate::infrastructure::valorant_api_http::build_client()?;
    let (weapons, skins, buddies, cards, sprays, titles) = tokio::try_join!(
        fetch_valorant_api_list::<WeaponData>(&client, "weapons"),
        fetch_valorant_api_list::<SkinData>(&client, "weapons/skins"),
        fetch_valorant_api_list::<BuddyData>(&client, "buddies"),
        fetch_valorant_api_list::<CardData>(&client, "playercards"),
        fetch_valorant_api_list::<SprayData>(&client, "sprays"),
        fetch_valorant_api_list::<TitleData>(&client, "playertitles"),
    )?;

    Ok(assemble_content_bundle(weapons, skins, buddies, cards, sprays, titles))
}

pub(crate) fn assemble_content_bundle(
    weapons: Vec<WeaponData>,
    skins: Vec<SkinData>,
    buddies: Vec<BuddyData>,
    cards: Vec<CardData>,
    sprays: Vec<SprayData>,
    titles: Vec<TitleData>,
) -> ContentBundle {
    let skin_weapons = build_skin_weapon_map(&weapons, &skins);
    let default_skins = default_skin_ids(&weapons);

    let mut lookup = HashMap::new();
    index_skins_from_weapons(&mut lookup, &weapons, &default_skins);
    index_skins_from_flat_list(&mut lookup, &skins, &skin_weapons, &default_skins);
    patch_missing_weapon_ids(&mut lookup, &skin_weapons);

    index_buddies(&mut lookup, buddies);
    index_cards(&mut lookup, cards);
    index_sprays(&mut lookup, sprays);
    index_titles(&mut lookup, titles);

    let mut weapon_rows = build_weapons(&weapons, &skins);
    apply_skin_counts_from_lookup(&mut weapon_rows, &lookup);

    ContentBundle {
        weapons: weapon_rows,
        lookup,
    }
}

pub(crate) fn content_bundle_is_healthy(bundle: &ContentBundle) -> bool {
    let linked_skins = bundle
        .lookup
        .values()
        .filter(|entry| entry.category == CAT_WEAPON_SKINS && entry.weapon_id.is_some())
        .count();
    let weapons_with_totals = bundle
        .weapons
        .iter()
        .filter(|weapon| weapon.total_skin_count > 0)
        .count();
    linked_skins >= 100 && weapons_with_totals >= 5
}

async fn fetch_valorant_api_list<T: for<'de> Deserialize<'de>>(
    client: &reqwest::Client,
    resource: &str,
) -> Result<Vec<T>, AppError> {
    let path = format!("{resource}?language=en-US");
    let parsed: ValorantApiResponse<Vec<T>> = crate::infrastructure::valorant_api_http::get_json(client, &path)
        .await
        .map_err(|error| match error {
            AppError::Network(message) => AppError::Network(format!("{resource}: {message}")),
            other => other,
        })?;
    Ok(parsed.data)
}

pub(crate) fn build_skin_weapon_map(weapons: &[WeaponData], skins: &[SkinData]) -> SkinWeaponMap {
    let mut map = skin_weapon_map_from_nested(weapons);
    extend_skin_weapon_map_from_asset_paths(&mut map, weapons, skins);
    map
}

pub(crate) fn skin_weapon_map_from_nested(weapons: &[WeaponData]) -> SkinWeaponMap {
    let mut map = SkinWeaponMap::new();
    for weapon in weapons {
        let weapon_id = weapon.uuid.to_lowercase();
        for skin in &weapon.skins {
            insert_skin_tree_ids(&mut map, skin, &weapon_id);
        }
    }
    map
}

pub(crate) fn extend_skin_weapon_map_from_asset_paths(
    map: &mut SkinWeaponMap,
    weapons: &[WeaponData],
    skins: &[SkinData],
) {
    let mut prefixes: Vec<(String, String)> = weapons
        .iter()
        .filter_map(|weapon| {
            let path = weapon.asset_path.as_deref()?;
            Some((asset_dir_prefix(path), weapon.uuid.to_lowercase()))
        })
        .collect();
    prefixes.sort_by(|left, right| right.0.len().cmp(&left.0.len()));

    for skin in skins {
        let weapon_id = map.get(&skin.uuid.to_lowercase()).cloned().or_else(|| {
            let path = skin.asset_path.as_deref()?.to_lowercase();
            prefixes
                .iter()
                .find(|(prefix, _)| path.starts_with(prefix.as_str()))
                .map(|(_, id)| id.clone())
        });

        let Some(weapon_id) = weapon_id else {
            continue;
        };
        insert_skin_tree_ids(map, skin, &weapon_id);
    }
}

fn insert_skin_tree_ids(map: &mut SkinWeaponMap, skin: &SkinData, weapon_id: &str) {
    map.insert(skin.uuid.to_lowercase(), weapon_id.to_string());
    for level in &skin.levels {
        map.insert(level.uuid.to_lowercase(), weapon_id.to_string());
    }
    for chroma in &skin.chromas {
        map.insert(chroma.uuid.to_lowercase(), weapon_id.to_string());
    }
}

fn asset_dir_prefix(asset_path: &str) -> String {
    let normalized = asset_path.replace('\\', "/");
    match normalized.rfind('/') {
        Some(index) => normalized[..=index].to_lowercase(),
        None => normalized.to_lowercase(),
    }
}

pub(crate) fn resolve_weapon_id(skin: &SkinData, skin_weapons: &SkinWeaponMap) -> Option<String> {
    skin.weapon_uuid
        .as_ref()
        .map(|id| id.to_lowercase())
        .or_else(|| skin_weapons.get(&skin.uuid.to_lowercase()).cloned())
}

pub(crate) fn default_skin_ids(weapons: &[WeaponData]) -> HashSet<String> {
    weapons
        .iter()
        .map(|weapon| weapon.default_skin_uuid.to_lowercase())
        .collect()
}

#[cfg(test)]
pub(crate) fn skin_weapon_map(weapons: &[WeaponData]) -> SkinWeaponMap {
    skin_weapon_map_from_nested(weapons)
}

fn build_weapons(weapons: &[WeaponData], flat_skins: &[SkinData]) -> Vec<CollectionWeaponDto> {
    let flat_by_uuid: HashMap<String, &SkinData> = flat_skins
        .iter()
        .map(|skin| (skin.uuid.to_lowercase(), skin))
        .collect();
    let mut rows = Vec::new();

    for weapon in weapons {
        let default_skin_id = weapon.default_skin_uuid.to_lowercase();
        let default_skin = weapon
            .skins
            .iter()
            .find(|skin| skin.uuid.eq_ignore_ascii_case(&default_skin_id))
            .or_else(|| flat_by_uuid.get(&default_skin_id).copied());
        let default_skin_name = default_skin
            .map(|skin| skin.display_name.clone())
            .unwrap_or_else(|| format!("Standard {}", weapon.display_name));
        let default_skin_preview = default_skin.and_then(|skin| skin_preview_url(skin));
        let default_skin_icon = default_skin.and_then(|skin| {
            skin.display_icon
                .clone()
                .or_else(|| skin.chromas.iter().find_map(|chroma| chroma.display_icon.clone()))
                .or_else(|| skin.chromas.iter().find_map(|chroma| chroma.full_render.clone()))
                .or_else(|| default_skin_preview.clone())
        });
        let sort_order = weapon
            .shop_data
            .as_ref()
            .and_then(|shop| shop.grid_position.as_ref())
            .map(|grid| grid.row * GRID_ROW_MULTIPLIER + grid.column)
            .unwrap_or(GRID_SORT_FALLBACK);
        let weapon_class = weapon
            .shop_data
            .as_ref()
            .and_then(|shop| shop.category_text.clone())
            .unwrap_or_else(|| "Weapons".to_string());
        let shop_cost = weapon.shop_data.as_ref().and_then(|shop| shop.cost);
        let primary_damage = weapon
            .weapon_stats
            .as_ref()
            .and_then(|stats| stats.damage_ranges.first());
        let wall_penetration = weapon.weapon_stats.as_ref().and_then(|stats| {
            stats
                .wall_penetration
                .as_deref()
                .map(format_wall_penetration)
        });

        let nested_count = weapon.skins.len() as u32;

        rows.push(CollectionWeaponDto {
            id                       : weapon.uuid.to_lowercase(),
            name                     : weapon.display_name.clone(),
            icon_url                 : weapon.display_icon.clone(),
            default_skin_id,
            default_skin_name,
            default_skin_icon_url    : default_skin_icon,
            default_skin_preview_url : default_skin_preview,
            weapon_class,
            sort_order,
            fire_rate                : weapon.weapon_stats.as_ref().and_then(|stats| stats.fire_rate),
            magazine_size            : weapon.weapon_stats.as_ref().and_then(|stats| stats.magazine_size),
            reload_time_seconds      : weapon
                .weapon_stats
                .as_ref()
                .and_then(|stats| stats.reload_time_seconds),
            equip_time_seconds       : weapon
                .weapon_stats
                .as_ref()
                .and_then(|stats| stats.equip_time_seconds),
            wall_penetration,
            head_damage              : primary_damage.and_then(|range| range.head_damage),
            body_damage              : primary_damage.and_then(|range| range.body_damage),
            shop_cost,
            total_skin_count         : nested_count,
        });
    }

    rows.sort_by(|a, b| a.sort_order.cmp(&b.sort_order).then_with(|| a.name.cmp(&b.name)));
    rows
}

fn apply_skin_counts_from_lookup(weapons: &mut [CollectionWeaponDto], lookup: &ContentLookup) {
    let mut counts: HashMap<String, HashSet<String>> = HashMap::new();
    for entry in lookup.values() {
        if entry.category != CAT_WEAPON_SKINS {
            continue;
        }
        let Some(weapon_id) = entry.weapon_id.as_ref() else {
            continue;
        };
        let Some(skin_id) = entry.skin_id.as_ref() else {
            continue;
        };
        counts
            .entry(weapon_id.clone())
            .or_default()
            .insert(skin_id.clone());
    }

    for weapon in weapons.iter_mut() {
        if let Some(set) = counts.get(&weapon.id) {
            weapon.total_skin_count = set.len() as u32;
        }
    }
}

fn skin_preview_url(skin: &SkinData) -> Option<String> {
    skin.chromas
        .iter()
        .find(|chroma| !variant_display_name(chroma.display_name.as_deref(), &skin.display_name).contains('('))
        .and_then(|chroma| chroma.full_render.clone())
        .or_else(|| skin.chromas.iter().find_map(|chroma| chroma.full_render.clone()))
        .or_else(|| skin.display_icon.clone())
}

fn variant_display_name(raw: Option<&str>, fallback: &str) -> String {
    raw.map(str::trim)
        .filter(|name| !name.is_empty())
        .map(|name| name.replace('\n', " "))
        .unwrap_or_else(|| fallback.to_string())
}

fn skin_entry(skin: &SkinData, weapon_id: Option<String>, is_default: bool) -> CatalogEntry {
    let skin_id = skin.uuid.to_lowercase();
    CatalogEntry {
        name              : skin.display_name.clone(),
        icon_url          : skin.display_icon.clone(),
        preview_url       : skin_preview_url(skin),
        swatch_url        : None,
        video_url         : None,
        category          : CAT_WEAPON_SKINS.to_string(),
        weapon_id,
        skin_id           : Some(skin_id.clone()),
        group_id          : Some(skin_id),
        content_tier_uuid : skin.content_tier_uuid.clone(),
        is_default,
        is_level          : false,
    }
}

fn skin_level_entry(
    skin: &SkinData,
    level: &SkinLevel,
    weapon_id: Option<String>,
    is_default: bool,
) -> CatalogEntry {
    let skin_id = skin.uuid.to_lowercase();
    CatalogEntry {
        name              : variant_display_name(level.display_name.as_deref(), &skin.display_name),
        icon_url          : level.display_icon.clone().or_else(|| skin.display_icon.clone()),
        preview_url       : skin_preview_url(skin),
        swatch_url        : None,
        video_url         : level.streamed_video.clone(),
        category          : CAT_WEAPON_SKINS.to_string(),
        weapon_id,
        skin_id           : Some(skin_id.clone()),
        group_id          : Some(skin_id),
        content_tier_uuid : skin.content_tier_uuid.clone(),
        is_default,
        is_level          : true,
    }
}

fn skin_chroma_entry(
    skin: &SkinData,
    chroma: &SkinChroma,
    weapon_id: Option<String>,
    is_default: bool,
) -> CatalogEntry {
    let skin_id = skin.uuid.to_lowercase();
    CatalogEntry {
        name              : variant_display_name(chroma.display_name.as_deref(), &skin.display_name),
        icon_url          : chroma.display_icon.clone().or_else(|| skin.display_icon.clone()),
        preview_url       : chroma.full_render.clone().or_else(|| skin_preview_url(skin)),
        swatch_url        : chroma.swatch.clone(),
        video_url         : chroma.streamed_video.clone(),
        category          : CAT_WEAPON_SKINS.to_string(),
        weapon_id,
        skin_id           : Some(skin_id.clone()),
        group_id          : Some(skin_id),
        content_tier_uuid : skin.content_tier_uuid.clone(),
        is_default,
        is_level          : false,
    }
}

fn insert_skin_tree(
    lookup: &mut ContentLookup,
    skin: &SkinData,
    weapon_id: Option<String>,
    is_default: bool,
) {
    let skin_id = skin.uuid.to_lowercase();
    lookup.insert(skin_id, skin_entry(skin, weapon_id.clone(), is_default));
    for level in &skin.levels {
        lookup.insert(
            level.uuid.to_lowercase(),
            skin_level_entry(skin, level, weapon_id.clone(), is_default),
        );
    }
    for chroma in &skin.chromas {
        lookup.insert(
            chroma.uuid.to_lowercase(),
            skin_chroma_entry(skin, chroma, weapon_id.clone(), is_default),
        );
    }
}

fn index_skins_from_weapons(
    lookup: &mut ContentLookup,
    weapons: &[WeaponData],
    default_skins: &HashSet<String>,
) {
    for weapon in weapons {
        let weapon_id = weapon.uuid.to_lowercase();
        for skin in &weapon.skins {
            let is_default = default_skins.contains(&skin.uuid.to_lowercase());
            insert_skin_tree(lookup, skin, Some(weapon_id.clone()), is_default);
        }
    }
}

fn index_skins_from_flat_list(
    lookup: &mut ContentLookup,
    skins: &[SkinData],
    skin_weapons: &SkinWeaponMap,
    default_skins: &HashSet<String>,
) {
    for skin in skins {
        let skin_key = skin.uuid.to_lowercase();
        let is_default = default_skins.contains(&skin_key);
        let weapon_id = resolve_weapon_id(skin, skin_weapons);

        if let Some(existing) = lookup.get_mut(&skin_key) {
            if existing.weapon_id.is_none() {
                existing.weapon_id = weapon_id.clone();
            }
        } else {
            insert_skin_tree(lookup, skin, weapon_id.clone(), is_default);
            continue;
        }

        for level in &skin.levels {
            let key = level.uuid.to_lowercase();
            if let Some(entry) = lookup.get_mut(&key) {
                if entry.weapon_id.is_none() {
                    entry.weapon_id = weapon_id.clone();
                }
            } else {
                lookup.insert(key, skin_level_entry(skin, level, weapon_id.clone(), is_default));
            }
        }
        for chroma in &skin.chromas {
            let key = chroma.uuid.to_lowercase();
            if let Some(entry) = lookup.get_mut(&key) {
                if entry.weapon_id.is_none() {
                    entry.weapon_id = weapon_id.clone();
                }
            } else {
                lookup.insert(key, skin_chroma_entry(skin, chroma, weapon_id.clone(), is_default));
            }
        }
    }
}

fn patch_missing_weapon_ids(lookup: &mut ContentLookup, skin_weapons: &SkinWeaponMap) {
    for (id, entry) in lookup.iter_mut() {
        if entry.category != CAT_WEAPON_SKINS || entry.weapon_id.is_some() {
            continue;
        }
        if let Some(weapon_id) = skin_weapons.get(id) {
            entry.weapon_id = Some(weapon_id.clone());
            continue;
        }
        if let Some(skin_id) = entry.skin_id.as_ref() {
            if let Some(weapon_id) = skin_weapons.get(skin_id) {
                entry.weapon_id = Some(weapon_id.clone());
            }
        }
    }
}

fn buddy_preview_icon(buddy: &BuddyData) -> Option<String> {
    buddy
        .levels
        .iter()
        .filter_map(|level| level.display_icon.clone())
        .next()
        .or_else(|| buddy.display_icon.clone())
}

fn index_buddies(lookup: &mut ContentLookup, buddies: Vec<BuddyData>) {
    for buddy in buddies {
        let base_icon = buddy.display_icon.clone();
        let preview_icon = buddy_preview_icon(&buddy);
        let group_id = buddy.uuid.to_lowercase();
        let entry = CatalogEntry {
            name: buddy.display_name.clone(),
            icon_url: base_icon.clone(),
            preview_url: preview_icon,
            swatch_url: None,
            video_url: None,
            category: CAT_GUN_BUDDIES.to_string(),
            weapon_id: None,
            skin_id: None,
            group_id: Some(group_id.clone()),
            content_tier_uuid: None,
            is_default: false,
            is_level: false,
        };
        lookup.insert(group_id, entry.clone());
        for level in &buddy.levels {
            let icon = level.display_icon.clone().or(base_icon.clone());
            lookup.insert(
                level.uuid.to_lowercase(),
                CatalogEntry {
                    icon_url    : icon.clone(),
                    preview_url : icon,
                    ..entry.clone()
                },
            );
        }
    }
}

fn index_cards(lookup: &mut ContentLookup, cards: Vec<CardData>) {
    for card in cards {
        let uuid = card.uuid.to_lowercase();
        let is_default = uuid == DEFAULT_PLAYER_CARD_ID;
        let icon = card.small_art.clone().or(card.large_art.clone());
        let preview = card.large_art.or(card.small_art);
        lookup.insert(
            uuid,
            CatalogEntry {
                name              : card.display_name,
                icon_url          : icon,
                preview_url       : preview,
                swatch_url        : None,
                video_url         : None,
                category          : CAT_PLAYER_CARDS.to_string(),
                weapon_id         : None,
                skin_id           : None,
                group_id          : None,
                content_tier_uuid : None,
                is_default,
                is_level          : false,
            },
        );
    }
}

fn spray_entry(spray: &SprayData) -> CatalogEntry {
    let group_id = spray.uuid.to_lowercase();
    let icon = spray.full_transparent_icon.clone().or(spray.display_icon.clone());
    CatalogEntry {
        name              : spray.display_name.clone(),
        icon_url          : icon.clone(),
        preview_url       : icon,
        swatch_url        : None,
        video_url         : None,
        category          : CAT_SPRAYS.to_string(),
        weapon_id         : None,
        skin_id           : None,
        is_default        : group_id == DEFAULT_SPRAY_ID,
        group_id          : Some(group_id),
        content_tier_uuid : None,
        is_level          : false,
    }
}

fn index_sprays(lookup: &mut ContentLookup, sprays: Vec<SprayData>) {
    for spray in sprays {
        let entry = spray_entry(&spray);
        lookup.insert(spray.uuid.to_lowercase(), entry.clone());
        for level in &spray.levels {
            let icon = level.display_icon.clone().or(entry.icon_url.clone());
            lookup.insert(
                level.uuid.to_lowercase(),
                CatalogEntry {
                    icon_url    : icon.clone(),
                    preview_url : icon,
                    ..entry.clone()
                },
            );
        }
    }
}

fn index_titles(lookup: &mut ContentLookup, titles: Vec<TitleData>) {
    for title in titles {
        let Some(name) = title.title_text.filter(|text| !text.is_empty()) else {
            continue;
        };
        lookup.insert(
            title.uuid.to_lowercase(),
            CatalogEntry {
                name,
                icon_url: None,
                preview_url: None,
                swatch_url: None,
                video_url: None,
                category: CAT_TITLES.to_string(),
                weapon_id: None,
                skin_id: None,
                group_id: None,
                content_tier_uuid: None,
                is_default: false,
                is_level: false,
            },
        );
    }
}
