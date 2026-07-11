use std::time::Duration;

pub(crate) const GRID_ROW_MULTIPLIER: i32 = 100;
pub(crate) const GRID_SORT_FALLBACK: i32  = 9999;

pub(crate) const OWNED_ITEM_TYPES: [(&str, &str); 7] = [
    (ITEM_TYPE_SKIN, CAT_WEAPON_SKINS),
    (ITEM_TYPE_SKIN_CHROMA, CAT_WEAPON_SKINS),
    (ITEM_TYPE_BUDDY, CAT_GUN_BUDDIES),
    (ITEM_TYPE_CARD, CAT_PLAYER_CARDS),
    (ITEM_TYPE_SPRAY, CAT_SPRAYS),
    (ITEM_TYPE_SPRAY_LEVEL, CAT_SPRAYS),
    (ITEM_TYPE_TITLE, CAT_TITLES),
];

pub(crate) const CONTENT_CACHE_TTL: Duration = Duration::from_secs(86_400);
pub(crate) const CONTENT_CACHE_FILE: &str    = "collection_content_cache_v12.json";

pub(crate) const DEFAULT_PLAYER_CARD_ID: &str = "9fb348bc-41a0-91ad-8a3e-818035c4e561";
pub(crate) const DEFAULT_SPRAY_ID: &str       = "0a6db78c-48b9-a32d-c47a-82be597584c1";

pub(crate) const ITEM_TYPE_SKIN: &str        = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";
pub(crate) const ITEM_TYPE_SKIN_CHROMA: &str = "3ad1b2b2-acdb-4524-852f-954a76ddae0a";
pub(crate) const ITEM_TYPE_BUDDY: &str       = "dd3bf334-87f3-40bd-b043-682a57a8dc3a";
pub(crate) const ITEM_TYPE_CARD: &str        = "3f296c07-64c3-494c-923b-fe692a4fa1bd";
pub(crate) const ITEM_TYPE_SPRAY: &str       = "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475";
pub(crate) const ITEM_TYPE_SPRAY_LEVEL: &str = "290f8769-97c6-492a-a1a8-caacf3d5b325";
pub(crate) const ITEM_TYPE_TITLE: &str       = "de7caa6b-adf7-4588-bbd1-143831e786c6";

pub(crate) const CAT_WEAPON_SKINS: &str = "weapon_skins";
pub(crate) const CAT_GUN_BUDDIES: &str  = "gun_buddies";
pub(crate) const CAT_PLAYER_CARDS: &str = "player_cards";
pub(crate) const CAT_SPRAYS: &str       = "sprays";
pub(crate) const CAT_TITLES: &str       = "titles";
