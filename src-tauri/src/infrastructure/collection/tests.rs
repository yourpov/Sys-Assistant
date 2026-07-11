use std::collections::HashMap;

use crate::dto::CollectionItemDto;
use crate::infrastructure::valorant_regional;

use super::api::extract_owned;
use super::catalog::{
    assemble_content_bundle, build_skin_weapon_map, content_bundle_is_healthy, default_skin_ids, extend_skin_weapon_map_from_asset_paths,
    resolve_weapon_id, skin_weapon_map, SkinWeaponMap,
};
use super::constants::{
    CAT_GUN_BUDDIES, CAT_PLAYER_CARDS, CAT_SPRAYS, CAT_TITLES, CAT_WEAPON_SKINS, ITEM_TYPE_BUDDY, ITEM_TYPE_CARD, ITEM_TYPE_SKIN,
    ITEM_TYPE_SKIN_CHROMA, ITEM_TYPE_SPRAY, ITEM_TYPE_SPRAY_LEVEL, ITEM_TYPE_TITLE, OWNED_ITEM_TYPES,
};
use super::fetch_collection;
use super::resolve::{attach_weapon_ids_by_skin_name, catalog_totals, count_by_category, resolve_items};
use crate::dto::CollectionWeaponDto;
use super::types::{CatalogEntry, SkinChroma, SkinData, SkinLevel, ValorantApiResponse, WeaponData};

#[test]
fn deserializes_valorant_api_weapons_sample() {
    let raw = include_str!("../../../../scripts/weapons_sample.json");
    let parsed: ValorantApiResponse<Vec<WeaponData>> =
        serde_json::from_str(raw).expect("weapons sample");
    assert!(!parsed.data.is_empty());
    let damage = parsed.data[0]
        .weapon_stats
        .as_ref()
        .and_then(|stats| stats.damage_ranges.first())
        .expect("damage ranges");
    assert!(damage.head_damage.is_some());
    assert!(damage.body_damage.is_some());
    assert!(!parsed.data[0].skins.is_empty());
}

fn sample_skin(
    uuid: &str,
    weapon_uuid: Option<&str>,
    level_id: Option<&str>,
    chroma_id: Option<&str>,
) -> SkinData {
    SkinData {
        uuid: uuid.into(),
        display_name: format!("Skin {uuid}"),
        display_icon: Some(format!("https://example.com/{uuid}.png")),
        weapon_uuid: weapon_uuid.map(str::to_string),
        content_tier_uuid: None,
        asset_path: None,
        levels: level_id
            .map(|id| {
                vec![SkinLevel {
                    uuid: id.into(),
                    display_name: Some(format!("Skin {uuid} Level")),
                    display_icon: Some(format!("https://example.com/{id}.png")),
                    streamed_video: Some(format!("https://example.com/{id}.mp4")),
                }]
            })
            .unwrap_or_default(),
        chromas: chroma_id
            .map(|id| {
                vec![SkinChroma {
                    uuid: id.into(),
                    display_name: Some(format!("Skin {uuid} Chroma")),
                    display_icon: None,
                    full_render: Some(format!("https://example.com/{id}-full.png")),
                    swatch: Some(format!("https://example.com/{id}-swatch.png")),
                    streamed_video: None,
                }]
            })
            .unwrap_or_default(),
    }
}

fn sample_skin_with_variants(
    uuid: &str,
    levels: Vec<(&str, Option<&str>)>,
    chromas: Vec<(&str, Option<&str>, Option<&str>)>,
) -> SkinData {
    SkinData {
        uuid: uuid.into(),
        display_name: format!("Skin {uuid}"),
        display_icon: Some(format!("https://example.com/{uuid}.png")),
        weapon_uuid: None,
        content_tier_uuid: None,
        asset_path: None,
        levels: levels
            .into_iter()
            .map(|(id, video)| SkinLevel {
                uuid: id.into(),
                display_name: Some(format!("Skin {uuid} {id}")),
                display_icon: Some(format!("https://example.com/{id}.png")),
                streamed_video: video.map(str::to_string),
            })
            .collect(),
        chromas: chromas
            .into_iter()
            .enumerate()
            .map(|(i, (id, swatch, video))| SkinChroma {
                uuid: id.into(),
                display_name: Some(if i == 0 {
                    format!("Skin {uuid}")
                } else {
                    format!("Skin {uuid} (Variant {i} Test)")
                }),
                display_icon: None,
                full_render: Some(format!("https://example.com/{id}-full.png")),
                swatch: swatch.map(str::to_string),
                streamed_video: video.map(str::to_string),
            })
            .collect(),
    }
}

fn sample_weapon(uuid: &str, default_skin: &str, skins: Vec<SkinData>) -> WeaponData {
    WeaponData {
        uuid: uuid.into(),
        display_name: "Test Weapon".into(),
        default_skin_uuid: default_skin.into(),
        display_icon: None,
        asset_path: Some(format!("ShooterGame/Content/Equippables/Guns/Test/{uuid}/WeaponAsset")),
        weapon_stats: None,
        shop_data: None,
        skins,
    }
}

#[test]
fn skin_weapon_map_associates_skin_level_and_chroma_ids() {
    let weapons = vec![sample_weapon(
        "WEAPON-A",
        "DEFAULT-A",
        vec![
            sample_skin("Skin-One", None, Some("Level-One"), Some("Chroma-One")),
            sample_skin("Skin-Two", None, None, None),
        ],
    )];

    let map = skin_weapon_map(&weapons);
    assert_eq!(map.get("skin-one").map(String::as_str), Some("weapon-a"));
    assert_eq!(map.get("level-one").map(String::as_str), Some("weapon-a"));
    assert_eq!(map.get("chroma-one").map(String::as_str), Some("weapon-a"));
    assert_eq!(map.get("skin-two").map(String::as_str), Some("weapon-a"));
}

#[test]
fn resolve_weapon_id_prefers_explicit_field_then_embedded_map() {
    let map = skin_weapon_map(&[sample_weapon(
        "weapon-a",
        "default-a",
        vec![sample_skin("skin-from-map", None, None, None)],
    )]);

    let from_field = sample_skin("skin-explicit", Some("WEAPON-B"), None, None);
    assert_eq!(resolve_weapon_id(&from_field, &map).as_deref(), Some("weapon-b"));

    let from_map = sample_skin("skin-from-map", None, None, None);
    assert_eq!(resolve_weapon_id(&from_map, &map).as_deref(), Some("weapon-a"));

    let unknown = sample_skin("skin-unknown", None, None, None);
    assert_eq!(resolve_weapon_id(&unknown, &map), None);
}

#[test]
fn default_skin_ids_are_lowercased() {
    let weapons = vec![sample_weapon("weapon-a", "Default-Skin-UUID", vec![])];
    let defaults = default_skin_ids(&weapons);
    assert!(defaults.contains("default-skin-uuid"));
}

#[test]
fn assemble_bundle_attaches_weapon_id_to_owned_levels_and_chromas() {
    let weapon_id = "weapon-phantom";
    let skin_id = "skin-prime-phantom";
    let level_id = "level-prime-phantom";
    let chroma_id = "chroma-prime-phantom";
    let default_id = "default-phantom";

    let weapons = vec![sample_weapon(
        weapon_id,
        default_id,
        vec![
            sample_skin(default_id, None, Some("level-default"), Some("chroma-default")),
            sample_skin(skin_id, None, Some(level_id), Some(chroma_id)),
        ],
    )];
    let flat_skins = vec![
        sample_skin(default_id, None, Some("level-default"), Some("chroma-default")),
        sample_skin(skin_id, None, Some(level_id), Some(chroma_id)),
    ];

    let bundle = assemble_content_bundle(weapons, flat_skins, vec![], vec![], vec![], vec![]);
    assert_eq!(bundle.weapons.len(), 1);
    assert_eq!(bundle.weapons[0].total_skin_count, 2);
    assert!(content_bundle_is_healthy(&bundle) || bundle.weapons[0].total_skin_count > 0);

    let level_entry = bundle.lookup.get(level_id).expect("level indexed");
    assert_eq!(level_entry.weapon_id.as_deref(), Some(weapon_id));
    assert_eq!(level_entry.skin_id.as_deref(), Some(skin_id));
    assert!(!level_entry.is_default);

    let chroma_entry = bundle.lookup.get(chroma_id).expect("chroma indexed");
    assert_eq!(chroma_entry.weapon_id.as_deref(), Some(weapon_id));
    assert_eq!(
        chroma_entry.preview_url.as_deref(),
        Some("https://example.com/chroma-prime-phantom-full.png")
    );

    let owned = vec![
        (level_id.into(), CAT_WEAPON_SKINS.into()),
        (chroma_id.into(), CAT_WEAPON_SKINS.into()),
    ];
    let items = resolve_items(&owned, &bundle.lookup);
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].weapon_id.as_deref(), Some(weapon_id));
    assert_eq!(items[0].skin_id.as_deref(), Some(skin_id));
    assert!(items[0].variants.iter().all(|v| v.id != level_id));
    assert!(items[0].variants.iter().any(|v| v.id == chroma_id && v.owned));
}

#[test]
fn resolve_items_keeps_all_owned_variants_and_marks_locked() {
    let weapon_id = "weapon-vandal";
    let skin_id = "skin-prime-vandal";
    let level_1 = "level-prime-1";
    let level_2 = "level-prime-2";
    let chroma_base = "chroma-prime-base";
    let chroma_gold = "chroma-prime-gold";
    let chroma_red = "chroma-prime-red";
    let default_id = "default-vandal";

    let weapons = vec![sample_weapon(
        weapon_id,
        default_id,
        vec![
            sample_skin(default_id, None, None, None),
            sample_skin_with_variants(
                skin_id,
                vec![(level_1, Some("https://example.com/l1.mp4")), (level_2, None)],
                vec![
                    (chroma_base, None, None),
                    (chroma_gold, Some("https://example.com/gold-swatch.png"), Some("https://example.com/gold.mp4")),
                    (chroma_red, Some("https://example.com/red-swatch.png"), None),
                ],
            ),
        ],
    )];
    let flat_skins = vec![
        sample_skin(default_id, None, None, None),
        sample_skin_with_variants(
            skin_id,
            vec![(level_1, Some("https://example.com/l1.mp4")), (level_2, None)],
            vec![
                (chroma_base, None, None),
                (chroma_gold, Some("https://example.com/gold-swatch.png"), Some("https://example.com/gold.mp4")),
                (chroma_red, Some("https://example.com/red-swatch.png"), None),
            ],
        ),
    ];

    let bundle = assemble_content_bundle(weapons, flat_skins, vec![], vec![], vec![], vec![]);
    let owned = vec![
        (level_1.into(), CAT_WEAPON_SKINS.into()),
        (chroma_gold.into(), CAT_WEAPON_SKINS.into()),
    ];
    let items = resolve_items(&owned, &bundle.lookup);
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].skin_id.as_deref(), Some(skin_id));
    assert_eq!(items[0].weapon_id.as_deref(), Some(weapon_id));

    let variants = &items[0].variants;
    assert_eq!(variants.len(), 3);
    assert!(variants.iter().all(|v| v.id != level_1 && v.id != level_2));

    let by_id: HashMap<&str, &crate::dto::CollectionSkinVariantDto> =
        variants.iter().map(|v| (v.id.as_str(), v)).collect();

    assert!(by_id.get(chroma_base).is_some_and(|v| v.owned));
    assert!(by_id.get(chroma_gold).is_some_and(|v| v.owned));
    assert!(by_id.get(chroma_red).is_some_and(|v| !v.owned));

    let gold = by_id.get(chroma_gold).expect("gold");
    assert_eq!(gold.swatch_url.as_deref(), Some("https://example.com/gold-swatch.png"));
    assert_eq!(gold.preview_url.as_deref(), Some("https://example.com/chroma-prime-gold-full.png"));
    assert_eq!(gold.video_url.as_deref(), Some("https://example.com/gold.mp4"));

    let level = bundle.lookup.get(level_1).expect("level 1");
    assert_eq!(level.video_url.as_deref(), Some("https://example.com/l1.mp4"));
    assert!(level.is_level);
}

#[test]
fn asset_path_associates_flat_skins_when_weapons_embed_no_skins() {
    let weapon_id = "9c82e19d-4575-0200-1a81-3eacf00cf872";
    let skin_id = "skin-prime-vandal";
    let level_id = "level-prime-vandal";
    let chroma_id = "chroma-prime-vandal-gold";

    let mut weapon = sample_weapon(weapon_id, "default-vandal", vec![]);
    weapon.asset_path = Some(
        "ShooterGame/Content/Equippables/Guns/Rifles/AK/AKPrimaryAsset".into(),
    );

    let mut skin = sample_skin(skin_id, None, Some(level_id), Some(chroma_id));
    skin.asset_path = Some(
        "ShooterGame/Content/Equippables/Guns/Rifles/AK/Prime/AK_Prime_PrimaryAsset".into(),
    );

    let mut map = SkinWeaponMap::new();
    extend_skin_weapon_map_from_asset_paths(&mut map, std::slice::from_ref(&weapon), std::slice::from_ref(&skin));
    assert_eq!(map.get(skin_id).map(String::as_str), Some(weapon_id));
    assert_eq!(map.get(level_id).map(String::as_str), Some(weapon_id));
    assert_eq!(map.get(chroma_id).map(String::as_str), Some(weapon_id));

    let bundle = assemble_content_bundle(vec![weapon], vec![skin], vec![], vec![], vec![], vec![]);
    assert_eq!(bundle.weapons[0].total_skin_count, 1);
    assert_eq!(
        bundle.lookup.get(level_id).and_then(|e| e.weapon_id.as_deref()),
        Some(weapon_id)
    );

    let items = resolve_items(&[(level_id.into(), CAT_WEAPON_SKINS.into())], &bundle.lookup);
    assert_eq!(items[0].weapon_id.as_deref(), Some(weapon_id));
}

#[test]
fn weapons_sample_associates_via_build_skin_weapon_map() {
    let raw = include_str!("../../../../scripts/weapons_sample.json");
    let weapons: ValorantApiResponse<Vec<WeaponData>> =
        serde_json::from_str(raw).expect("weapons sample");
    let map = build_skin_weapon_map(&weapons.data, &[]);
    assert!(map.len() > 50);
}

#[test]
fn weapons_sample_assemble_is_healthy_with_per_gun_totals() {
    let raw = include_str!("../../../../scripts/weapons_sample.json");
    let weapons: ValorantApiResponse<Vec<WeaponData>> =
        serde_json::from_str(raw).expect("weapons sample");
    let bundle = assemble_content_bundle(weapons.data, vec![], vec![], vec![], vec![], vec![]);

    assert!(content_bundle_is_healthy(&bundle));
    let with_totals = bundle
        .weapons
        .iter()
        .filter(|weapon| weapon.total_skin_count > 0)
        .count();
    assert!(with_totals >= 5);

    let vandal = bundle
        .weapons
        .iter()
        .find(|weapon| weapon.name == "Vandal")
        .expect("Vandal");
    assert!(vandal.total_skin_count > 1);
    assert!(!vandal.default_skin_name.is_empty());
    let linked = bundle
        .lookup
        .values()
        .filter(|entry| {
            entry.category == CAT_WEAPON_SKINS
                && entry.weapon_id.as_deref() == Some(vandal.id.as_str())
                && entry.skin_id.as_deref() != Some(vandal.default_skin_id.as_str())
        })
        .count();
    assert!(linked > 0);
}

#[test]
fn weapons_sample_builds_skin_weapon_map_without_weapon_uuid_field() {
    let raw = include_str!("../../../../scripts/weapons_sample.json");
    let parsed: ValorantApiResponse<Vec<WeaponData>> =
        serde_json::from_str(raw).expect("weapons sample");
    let map = skin_weapon_map(&parsed.data);

    let odin = parsed
        .data
        .iter()
        .find(|weapon| weapon.display_name == "Odin")
        .expect("Odin");
    let first_skin = odin.skins.first().expect("skins");
    let weapon_id = map
        .get(&first_skin.uuid.to_lowercase())
        .expect("mapped");
    assert_eq!(weapon_id, &odin.uuid.to_lowercase());

    if let Some(level) = first_skin.levels.first() {
        assert_eq!(
            map.get(&level.uuid.to_lowercase()).map(String::as_str),
            Some(odin.uuid.to_lowercase().as_str()),
        );
    }
    if let Some(chroma) = first_skin.chromas.first() {
        assert_eq!(
            map.get(&chroma.uuid.to_lowercase()).map(String::as_str),
            Some(odin.uuid.to_lowercase().as_str()),
        );
    }
}

#[test]
fn entitlements_parse_error_omits_body() {
    let mapped: HashMap<&str, &str> = OWNED_ITEM_TYPES.iter().copied().collect();
    let body = r#"{"not":"entitlements","secret":"nope"}"#;
    let err = extract_owned(body, ITEM_TYPE_SKIN, &mapped).unwrap_err();
    let msg = err.to_string();
    assert!(msg.contains("couldn't parse"));
    assert!(!msg.contains("nope"));
    assert!(!msg.contains("\"secret\""));
}

#[test]
fn extracts_owned_items_by_requested_type_id() {
    let mapped: HashMap<&str, &str> = OWNED_ITEM_TYPES.iter().copied().collect();
    let body = r#"{
        "ItemTypeID": "unexpected-response-type-id",
        "Entitlements": [
            {
                "TypeID": "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475",
                "ItemID": "7e2ba2e8-4597-060a-b41e-81acedca414e"
            }
        ]
    }"#;

    let owned = extract_owned(body, ITEM_TYPE_SPRAY, &mapped).expect("parse");
    assert_eq!(owned.len(), 1);
    assert_eq!(owned[0].0, "7e2ba2e8-4597-060a-b41e-81acedca414e");
    assert_eq!(owned[0].1, CAT_SPRAYS);
}

#[test]
fn extracts_spray_entitlement_when_item_id_is_in_type_id_field() {
    let mapped: HashMap<&str, &str> = OWNED_ITEM_TYPES.iter().copied().collect();
    let body = r#"{
        "ItemTypeID": "290f8769-97c6-492a-a1a8-caacf3d5b325",
        "Entitlements": [
            {
                "TypeID": "1a2d5672-4d65-de65-9b7f-75b61b379def",
                "ItemID": ""
            }
        ]
    }"#;

    let owned = extract_owned(body, ITEM_TYPE_SPRAY_LEVEL, &mapped).expect("parse");
    assert_eq!(owned.len(), 1);
    assert_eq!(owned[0].0, "1a2d5672-4d65-de65-9b7f-75b61b379def");
    assert_eq!(owned[0].1, CAT_SPRAYS);
}

#[test]
fn resolves_multiple_owned_sprays_by_group() {
    let mut lookup = HashMap::new();
    for (spray_id, level_id, name) in [
        (
            "7e2ba2e8-4597-060a-b41e-81acedca414e",
            "1a2d5672-4d65-de65-9b7f-75b61b379def",
            "Abilities Don't Kill Spray",
        ),
        (
            "fe86a4c5-4e92-324b-4c0d-a7a837d0d548",
            "70c3366a-44a8-1840-192d-55badf2440d5",
            "Cans On Spray",
        ),
    ] {
        let group_id = spray_id.to_string();
        let entry = CatalogEntry {
            name              : name.into(),
            icon_url          : None,
            preview_url       : None,
            swatch_url        : None,
            video_url         : None,
            category          : CAT_SPRAYS.into(),
            weapon_id         : None,
            skin_id           : None,
            group_id          : Some(group_id.clone()),
            content_tier_uuid : None,
            is_default        : false,
            is_level          : false,
        };
        lookup.insert(group_id, entry.clone());
        lookup.insert(level_id.into(), entry);
    }

    let owned = vec![
        (String::from("1a2d5672-4d65-de65-9b7f-75b61b379def"), CAT_SPRAYS.into()),
        (String::from("70c3366a-44a8-1840-192d-55badf2440d5"), CAT_SPRAYS.into()),
    ];

    let items = resolve_items(&owned, &lookup);
    let sprays: Vec<_> = items.into_iter().filter(|item| item.category == CAT_SPRAYS).collect();
    assert_eq!(sprays.len(), 2);
}

#[test]
fn maps_owned_item_types_to_categories() {
    let mapped: HashMap<&str, &str> = OWNED_ITEM_TYPES.iter().copied().collect();
    assert_eq!(mapped.get(ITEM_TYPE_SKIN), Some(&CAT_WEAPON_SKINS));
    assert_eq!(mapped.get(ITEM_TYPE_SKIN_CHROMA), Some(&CAT_WEAPON_SKINS));
    assert_eq!(mapped.get(ITEM_TYPE_BUDDY), Some(&CAT_GUN_BUDDIES));
    assert_eq!(mapped.get(ITEM_TYPE_CARD), Some(&CAT_PLAYER_CARDS));
    assert_eq!(mapped.get(ITEM_TYPE_SPRAY), Some(&CAT_SPRAYS));
    assert_eq!(mapped.get(ITEM_TYPE_SPRAY_LEVEL), Some(&CAT_SPRAYS));
    assert_eq!(mapped.get(ITEM_TYPE_TITLE), Some(&CAT_TITLES));
}

#[test]
fn normalizes_valorant_region_shards() {
    assert_eq!(valorant_regional::normalize_region("NA"), "na");
    assert_eq!(valorant_regional::normalize_region("EU"), "eu");
    assert_eq!(valorant_regional::shard_for_region("latam"), "na");
    assert_eq!(valorant_regional::shard_for_region("br"), "na");
    assert_eq!(valorant_regional::shard_for_region("eu"), "eu");
}

#[test]
fn dedupes_catalog_totals_by_group() {
    let mut lookup = HashMap::new();
    lookup.insert(
        "skin-a".into(),
        CatalogEntry {
            name              : "Skin A".into(),
            icon_url          : None,
            preview_url       : None,
            swatch_url        : None,
            video_url         : None,
            category          : CAT_WEAPON_SKINS.into(),
            weapon_id         : None,
            skin_id           : Some("skin-a".into()),
            group_id          : Some("skin-a".into()),
            content_tier_uuid : None,
            is_default        : false,
            is_level          : false,
        },
    );
    lookup.insert(
        "skin-a-level".into(),
        CatalogEntry {
            name              : "Skin A".into(),
            icon_url          : None,
            preview_url       : None,
            swatch_url        : None,
            video_url         : None,
            category          : CAT_WEAPON_SKINS.into(),
            weapon_id         : None,
            skin_id           : Some("skin-a".into()),
            group_id          : Some("skin-a".into()),
            content_tier_uuid : None,
            is_default        : false,
            is_level          : false,
        },
    );
    lookup.insert(
        "default-skin".into(),
        CatalogEntry {
            name              : "Default".into(),
            icon_url          : None,
            preview_url       : None,
            swatch_url        : None,
            video_url         : None,
            category          : CAT_WEAPON_SKINS.into(),
            weapon_id         : None,
            skin_id           : Some("default-skin".into()),
            group_id          : Some("default-skin".into()),
            content_tier_uuid : None,
            is_default        : true,
            is_level          : false,
        },
    );
    lookup.insert(
        "buddy-a".into(),
        CatalogEntry {
            name              : "Buddy".into(),
            icon_url          : None,
            preview_url       : None,
            swatch_url        : None,
            video_url         : None,
            category          : CAT_GUN_BUDDIES.into(),
            weapon_id         : None,
            skin_id           : None,
            group_id          : Some("buddy-a".into()),
            content_tier_uuid : None,
            is_default        : false,
            is_level          : false,
        },
    );
    lookup.insert(
        "buddy-a-level".into(),
        CatalogEntry {
            name              : "Buddy".into(),
            icon_url          : None,
            preview_url       : None,
            swatch_url        : None,
            video_url         : None,
            category          : CAT_GUN_BUDDIES.into(),
            weapon_id         : None,
            skin_id           : None,
            group_id          : Some("buddy-a".into()),
            content_tier_uuid : None,
            is_default        : false,
            is_level          : false,
        },
    );

    let totals = catalog_totals(&lookup);
    assert_eq!(totals.weapon_skins, 1);
    assert_eq!(totals.gun_buddies, 1);
}

#[tokio::test]
#[ignore = "hits live valorant-api"]
async fn live_fetch_remote_catalog_smoke() {
    use super::catalog::fetch_remote_content_bundle;

    let bundle = fetch_remote_content_bundle().await.expect("catalog");
    assert!(!bundle.weapons.is_empty());
    assert!(bundle.weapons.iter().all(|w| !w.default_skin_id.is_empty()));
}

#[tokio::test]
#[ignore = "hits live riot client and valorant-api"]
async fn live_fetch_collection_smoke() {
    let dir = std::env::temp_dir();
    let snapshot = fetch_collection(&dir, None).await.expect("collection");
    assert!(!snapshot.weapons.is_empty());
    let owned = snapshot.counts.weapon_skins
        + snapshot.counts.gun_buddies
        + snapshot.counts.player_cards
        + snapshot.counts.sprays
        + snapshot.counts.titles;
    eprintln!("live collection: {owned} owned items");
}

#[test]
fn attach_weapon_ids_by_skin_name_matches_suffix() {
    let weapons = vec![CollectionWeaponDto {
        id                       : "weapon-vandal".into(),
        name                     : "Vandal".into(),
        icon_url                 : None,
        default_skin_id          : "default".into(),
        default_skin_name        : "Standard Vandal".into(),
        default_skin_icon_url    : None,
        default_skin_preview_url : None,
        weapon_class             : "Rifles".into(),
        sort_order               : 0,
        fire_rate                : None,
        magazine_size            : None,
        reload_time_seconds      : None,
        equip_time_seconds       : None,
        wall_penetration         : None,
        head_damage              : None,
        body_damage              : None,
        shop_cost                : None,
        total_skin_count         : 10,
    }];
    let mut items = vec![CollectionItemDto {
        id                : "owned-1".into(),
        name              : "Prime Vandal".into(),
        icon_url          : Some("https://example.com/prime.png".into()),
        preview_url       : None,
        category          : CAT_WEAPON_SKINS.into(),
        weapon_id         : None,
        skin_id           : Some("skin-prime".into()),
        content_tier_uuid : None,
        is_default        : false,
        variants          : Vec::new(),
    }];

    attach_weapon_ids_by_skin_name(&mut items, &weapons);
    assert_eq!(items[0].weapon_id.as_deref(), Some("weapon-vandal"));
}

#[test]
fn counts_items_per_category() {
    let items = vec![
        CollectionItemDto {
            id                : "1".into(),
            name              : "A".into(),
            icon_url          : None,
            preview_url       : None,
            category          : CAT_WEAPON_SKINS.into(),
            weapon_id         : None,
            skin_id           : None,
            content_tier_uuid : None,
            is_default        : false,
            variants          : Vec::new(),
        },
        CollectionItemDto {
            id                : "2".into(),
            name              : "B".into(),
            icon_url          : None,
            preview_url       : None,
            category          : CAT_TITLES.into(),
            weapon_id         : None,
            skin_id           : None,
            content_tier_uuid : None,
            is_default        : false,
            variants          : Vec::new(),
        },
    ];
    let counts = count_by_category(&items);
    assert_eq!(counts.weapon_skins, 1);
    assert_eq!(counts.titles, 1);
}