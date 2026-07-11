use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::dto::CollectionWeaponDto;

#[derive(Debug, Clone)]
pub(crate) struct CatalogEntry {
    pub(crate) name              : String,
    pub(crate) icon_url          : Option<String>,
    pub(crate) preview_url       : Option<String>,
    pub(crate) swatch_url        : Option<String>,
    pub(crate) video_url         : Option<String>,
    pub(crate) category          : String,
    pub(crate) weapon_id         : Option<String>,
    pub(crate) skin_id           : Option<String>,
    pub(crate) group_id          : Option<String>,
    pub(crate) content_tier_uuid : Option<String>,
    pub(crate) is_default        : bool,
    pub(crate) is_level          : bool,
}

pub(crate) type ContentLookup = HashMap<String, CatalogEntry>;

#[derive(Debug, Clone)]
pub(crate) struct ContentBundle {
    pub(crate) lookup : ContentLookup,
    pub(crate) weapons : Vec<CollectionWeaponDto>,
}

impl ContentBundle {
    pub(crate) fn empty() -> Self {
        Self {
            lookup : HashMap::new(),
            weapons: Vec::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct ValorantPdAuth {
    pub(crate) puuid            : String,
    pub(crate) access_token     : String,
    pub(crate) entitlements_jwt : String,
    pub(crate) client_version   : String,
    pub(crate) shard            : String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ChatSession {
    #[serde(rename = "game_name")]
    pub(crate) game_name : Option<String>,
    #[serde(rename = "game_tag")]
    pub(crate) game_tag  : Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct EntitlementsByType {
    #[serde(rename = "ItemTypeID")]
    pub(crate) item_type_id: String,
    #[serde(rename = "Entitlements", default)]
    pub(crate) entitlements: Vec<EntitlementItem>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct EntitlementItem {
    #[serde(rename = "TypeID", alias = "TypeId", alias = "typeId", default)]
    pub(crate) type_id: String,
    #[serde(rename = "ItemID", alias = "ItemId", alias = "itemId", default)]
    pub(crate) item_id: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ValorantApiResponse<T> {
    pub(crate) data: T,
}

#[derive(Debug, Deserialize)]
pub(crate) struct WeaponData {
    pub(crate) uuid : String,
    #[serde(rename = "displayName")]
    pub(crate) display_name : String,
    #[serde(rename = "defaultSkinUuid")]
    pub(crate) default_skin_uuid : String,
    #[serde(rename = "displayIcon")]
    pub(crate) display_icon : Option<String>,
    #[serde(rename = "assetPath", default)]
    pub(crate) asset_path : Option<String>,
    #[serde(rename = "weaponStats", default)]
    pub(crate) weapon_stats : Option<WeaponStatsData>,
    #[serde(rename = "shopData", default)]
    pub(crate) shop_data : Option<WeaponShopData>,
    #[serde(default)]
    pub(crate) skins : Vec<SkinData>,
}

#[derive(Debug, Deserialize, Default)]
pub(crate) struct WeaponStatsData {
    #[serde(rename = "fireRate", default)]
    pub(crate) fire_rate : Option<f64>,
    #[serde(rename = "magazineSize", default)]
    pub(crate) magazine_size : Option<i32>,
    #[serde(rename = "reloadTimeSeconds", default)]
    pub(crate) reload_time_seconds : Option<f64>,
    #[serde(rename = "equipTimeSeconds", default)]
    pub(crate) equip_time_seconds : Option<f64>,
    #[serde(rename = "wallPenetration", default)]
    pub(crate) wall_penetration : Option<String>,
    #[serde(rename = "damageRanges", default)]
    pub(crate) damage_ranges : Vec<DamageRangeData>,
}

#[derive(Debug, Deserialize, Default)]
pub(crate) struct DamageRangeData {
    #[serde(rename = "headDamage", default)]
    pub(crate) head_damage : Option<f64>,
    #[serde(rename = "bodyDamage", default)]
    pub(crate) body_damage : Option<f64>,
}

#[derive(Debug, Deserialize, Default)]
pub(crate) struct WeaponShopData {
    #[serde(default)]
    pub(crate) cost : Option<i32>,
    #[serde(rename = "categoryText", default)]
    pub(crate) category_text : Option<String>,
    #[serde(rename = "gridPosition", default)]
    pub(crate) grid_position : Option<WeaponGridPosition>,
}

#[derive(Debug, Deserialize, Default)]
pub(crate) struct WeaponGridPosition {
    pub(crate) row : i32,
    pub(crate) column : i32,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SkinData {
    pub(crate) uuid : String,
    #[serde(rename = "displayName")]
    pub(crate) display_name : String,
    #[serde(rename = "displayIcon")]
    pub(crate) display_icon : Option<String>,
    #[serde(rename = "weaponUuid")]
    pub(crate) weapon_uuid : Option<String>,
    #[serde(rename = "contentTierUuid")]
    pub(crate) content_tier_uuid : Option<String>,
    #[serde(rename = "assetPath", default)]
    pub(crate) asset_path : Option<String>,
    #[serde(default)]
    pub(crate) chromas : Vec<SkinChroma>,
    #[serde(default)]
    pub(crate) levels : Vec<SkinLevel>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SkinChroma {
    pub(crate) uuid : String,
    #[serde(rename = "displayName")]
    pub(crate) display_name : Option<String>,
    #[serde(rename = "displayIcon")]
    pub(crate) display_icon : Option<String>,
    #[serde(rename = "fullRender")]
    pub(crate) full_render : Option<String>,
    #[serde(default)]
    pub(crate) swatch : Option<String>,
    #[serde(rename = "streamedVideo", default)]
    pub(crate) streamed_video : Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SkinLevel {
    pub(crate) uuid : String,
    #[serde(rename = "displayName")]
    pub(crate) display_name : Option<String>,
    #[serde(rename = "displayIcon")]
    pub(crate) display_icon : Option<String>,
    #[serde(rename = "streamedVideo", default)]
    pub(crate) streamed_video : Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct BuddyData {
    pub(crate) uuid : String,
    #[serde(rename = "displayName")]
    pub(crate) display_name : String,
    #[serde(rename = "displayIcon")]
    pub(crate) display_icon : Option<String>,
    #[serde(default)]
    pub(crate) levels : Vec<BuddyLevel>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct BuddyLevel {
    pub(crate) uuid : String,
    #[serde(rename = "displayIcon")]
    pub(crate) display_icon : Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct CardData {
    pub(crate) uuid : String,
    #[serde(rename = "displayName")]
    pub(crate) display_name : String,
    #[serde(rename = "smallArt")]
    pub(crate) small_art : Option<String>,
    #[serde(rename = "largeArt")]
    pub(crate) large_art : Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SprayLevel {
    pub(crate) uuid : String,
    #[serde(rename = "displayIcon")]
    pub(crate) display_icon : Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SprayData {
    pub(crate) uuid : String,
    #[serde(rename = "displayName")]
    pub(crate) display_name : String,
    #[serde(rename = "displayIcon")]
    pub(crate) display_icon : Option<String>,
    #[serde(rename = "fullTransparentIcon")]
    pub(crate) full_transparent_icon : Option<String>,
    #[serde(default)]
    pub(crate) levels : Vec<SprayLevel>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct TitleData {
    pub(crate) uuid : String,
    #[serde(rename = "titleText")]
    pub(crate) title_text : Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct CachedContentFile {
    pub(crate) saved_at : String,
    pub(crate) lookup : HashMap<String, CachedCatalogEntry>,
    pub(crate) weapons : Vec<CachedWeaponEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct CachedCatalogEntry {
    pub(crate) name : String,
    pub(crate) icon_url : Option<String>,
    pub(crate) preview_url : Option<String>,
    #[serde(default)]
    pub(crate) swatch_url : Option<String>,
    #[serde(default)]
    pub(crate) video_url : Option<String>,
    pub(crate) category : String,
    pub(crate) weapon_id : Option<String>,
    pub(crate) skin_id : Option<String>,
    #[serde(default)]
    pub(crate) group_id : Option<String>,
    pub(crate) content_tier_uuid : Option<String>,
    pub(crate) is_default : bool,
    #[serde(default)]
    pub(crate) is_level : bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct CachedWeaponEntry {
    pub(crate) id : String,
    pub(crate) name : String,
    pub(crate) icon_url : Option<String>,
    pub(crate) default_skin_id : String,
    pub(crate) default_skin_name : String,
    pub(crate) default_skin_icon_url : Option<String>,
    pub(crate) default_skin_preview_url : Option<String>,
    pub(crate) weapon_class : String,
    pub(crate) sort_order : i32,
    #[serde(default)]
    pub(crate) fire_rate : Option<f64>,
    #[serde(default)]
    pub(crate) magazine_size : Option<i32>,
    #[serde(default)]
    pub(crate) reload_time_seconds : Option<f64>,
    #[serde(default)]
    pub(crate) equip_time_seconds : Option<f64>,
    #[serde(default)]
    pub(crate) wall_penetration : Option<String>,
    #[serde(default)]
    pub(crate) head_damage : Option<f64>,
    #[serde(default)]
    pub(crate) body_damage : Option<f64>,
    #[serde(default)]
    pub(crate) shop_cost : Option<i32>,
    #[serde(default)]
    pub(crate) total_skin_count : u32,
}
