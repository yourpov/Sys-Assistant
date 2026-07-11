use std::path::Path;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use crate::dto::CollectionWeaponDto;
use crate::error::AppError;
use crate::infrastructure::sync_lock::lock_or_recover;

use super::catalog::{content_bundle_is_healthy, fetch_remote_content_bundle};
use super::constants::{CONTENT_CACHE_FILE, CONTENT_CACHE_TTL};
use super::types::{CachedCatalogEntry, CachedContentFile, CachedWeaponEntry, CatalogEntry, ContentBundle};

static MEMORY_CACHE: LazyLock<Mutex<Option<(Instant, ContentBundle)>>> = LazyLock::new(|| Mutex::new(None));

pub(crate) async fn load_content_bundle(config_dir: &Path) -> Result<ContentBundle, AppError> {
    if let Some((inserted, bundle)) = lock_or_recover(&MEMORY_CACHE).as_ref() {
        if inserted.elapsed() < CONTENT_CACHE_TTL && content_bundle_is_healthy(bundle) {
            return Ok(bundle.clone());
        }
    }

    let cache_path = config_dir.join(CONTENT_CACHE_FILE);
    if let Ok(bundle) = read_disk_cache(&cache_path, false).await {
        if content_bundle_is_healthy(&bundle) {
            *lock_or_recover(&MEMORY_CACHE) = Some((Instant::now(), bundle.clone()));
            return Ok(bundle);
        }
    }

    match fetch_remote_content_bundle().await {
        Ok(bundle) => {
            if content_bundle_is_healthy(&bundle) {
                let _ = write_disk_cache(&cache_path, &bundle).await;
            }
            *lock_or_recover(&MEMORY_CACHE) = Some((Instant::now(), bundle.clone()));
            Ok(bundle)
        }
        Err(remote_error) => {
            if let Ok(stale) = read_disk_cache(&cache_path, true).await {
                *lock_or_recover(&MEMORY_CACHE) = Some((Instant::now(), stale.clone()));
                return Ok(stale);
            }
            Err(remote_error)
        }
    }
}

async fn read_disk_cache(path: &Path, allow_stale: bool) -> Result<ContentBundle, AppError> {
    let raw = tokio::fs::read_to_string(path).await.map_err(|e| AppError::Network(format!("couldn't read collection cache ({e})")))?;
    let cached: CachedContentFile =
        serde_json::from_str(&raw).map_err(|e| AppError::Network(format!("couldn't parse collection cache ({e})")))?;
    let saved_at = chrono::DateTime::parse_from_rfc3339(&cached.saved_at)
        .map_err(|e| AppError::Network(format!("couldn't parse collection cache timestamp ({e})")))?;
    if !allow_stale
        && chrono::Utc::now().signed_duration_since(saved_at).to_std().unwrap_or(Duration::ZERO) > CONTENT_CACHE_TTL
    {
        return Err(AppError::Network("collection cache expired".into()));
    }
    Ok(ContentBundle {
        lookup: cached
            .lookup
            .into_iter()
            .map(|(id, entry)| {
                (
                    id,
                    CatalogEntry {
                        name              : entry.name,
                        icon_url          : entry.icon_url,
                        preview_url       : entry.preview_url,
                        swatch_url        : entry.swatch_url,
                        video_url         : entry.video_url,
                        category          : entry.category,
                        weapon_id         : entry.weapon_id,
                        skin_id           : entry.skin_id,
                        group_id          : entry.group_id,
                        content_tier_uuid : entry.content_tier_uuid,
                        is_default        : entry.is_default,
                        is_level          : entry.is_level,
                    },
                )
            })
            .collect(),
        weapons: cached.weapons.into_iter().map(cached_weapon_to_dto).collect(),
    })
}

async fn write_disk_cache(path: &Path, bundle: &ContentBundle) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| AppError::Network(format!("couldn't create collection cache folder ({e})")))?;
    }
    let file = CachedContentFile {
        saved_at: chrono::Utc::now().to_rfc3339(),
        lookup: bundle
            .lookup
            .iter()
            .map(|(id, entry)| {
                (
                    id.clone(),
                    CachedCatalogEntry {
                        name              : entry.name.clone(),
                        icon_url          : entry.icon_url.clone(),
                        preview_url       : entry.preview_url.clone(),
                        swatch_url        : entry.swatch_url.clone(),
                        video_url         : entry.video_url.clone(),
                        category          : entry.category.clone(),
                        weapon_id         : entry.weapon_id.clone(),
                        skin_id           : entry.skin_id.clone(),
                        group_id          : entry.group_id.clone(),
                        content_tier_uuid : entry.content_tier_uuid.clone(),
                        is_default        : entry.is_default,
                        is_level          : entry.is_level,
                    },
                )
            })
            .collect(),
        weapons: bundle.weapons.iter().map(dto_weapon_to_cached).collect(),
    };
    let json = serde_json::to_string_pretty(&file).map_err(|e| AppError::Network(format!("couldn't encode collection cache ({e})")))?;
    tokio::fs::write(path, json)
        .await
        .map_err(|e| AppError::Network(format!("couldn't write collection cache ({e})")))?;
    Ok(())
}

fn cached_weapon_to_dto(entry: CachedWeaponEntry) -> CollectionWeaponDto {
    CollectionWeaponDto {
        id                       : entry.id,
        name                     : entry.name,
        icon_url                 : entry.icon_url,
        default_skin_id          : entry.default_skin_id,
        default_skin_name        : entry.default_skin_name,
        default_skin_icon_url    : entry.default_skin_icon_url,
        default_skin_preview_url : entry.default_skin_preview_url,
        weapon_class             : entry.weapon_class,
        sort_order               : entry.sort_order,
        fire_rate                : entry.fire_rate,
        magazine_size            : entry.magazine_size,
        reload_time_seconds      : entry.reload_time_seconds,
        equip_time_seconds       : entry.equip_time_seconds,
        wall_penetration         : entry.wall_penetration,
        head_damage              : entry.head_damage,
        body_damage              : entry.body_damage,
        shop_cost                : entry.shop_cost,
        total_skin_count         : entry.total_skin_count,
    }
}

fn dto_weapon_to_cached(weapon: &CollectionWeaponDto) -> CachedWeaponEntry {
    CachedWeaponEntry {
        id                       : weapon.id.clone(),
        name                     : weapon.name.clone(),
        icon_url                 : weapon.icon_url.clone(),
        default_skin_id          : weapon.default_skin_id.clone(),
        default_skin_name        : weapon.default_skin_name.clone(),
        default_skin_icon_url    : weapon.default_skin_icon_url.clone(),
        default_skin_preview_url : weapon.default_skin_preview_url.clone(),
        weapon_class             : weapon.weapon_class.clone(),
        sort_order               : weapon.sort_order,
        fire_rate                : weapon.fire_rate,
        magazine_size            : weapon.magazine_size,
        reload_time_seconds      : weapon.reload_time_seconds,
        equip_time_seconds       : weapon.equip_time_seconds,
        wall_penetration         : weapon.wall_penetration.clone(),
        head_damage              : weapon.head_damage,
        body_damage              : weapon.body_damage,
        shop_cost                : weapon.shop_cost,
        total_skin_count         : weapon.total_skin_count,
    }
}
