mod api;
mod cache;
mod catalog;
mod constants;
mod resolve;
mod types;

use std::path::Path;

use crate::dto::CollectionSnapshotDto;
use crate::error::AppError;
use crate::infrastructure::app_log::AppLogStore;

use api::{fetch_account_identity, fetch_owned_entitlements, fetch_valorant_pd_auth};
use cache::load_content_bundle;
use resolve::{attach_weapon_ids_by_skin_name, catalog_totals, count_by_category, resolve_items};
use types::ContentBundle;

pub async fn fetch_collection(config_dir: &Path, app_log: Option<&AppLogStore>) -> Result<CollectionSnapshotDto, AppError> {
    let (catalog_result, auth_result) = tokio::join!(load_content_bundle(config_dir), fetch_valorant_pd_auth());

    let (bundle, catalog_loaded, catalog_warning) = match catalog_result {
        Ok(bundle) => (bundle, true, None),
        Err(error) => (
            ContentBundle::empty(),
            false,
            Some(format!(
                "valorant-api.com couldn't be reached ({error}). Default weapon skins and stats may be unavailable until you refresh again."
            )),
        ),
    };

    let (account_name, account_tag, mut items, session_warning) = match auth_result {
        Ok(auth) => {
            let (identity, entitlements) =
                tokio::join!(fetch_account_identity(), fetch_owned_entitlements(&auth, app_log));
            let (account_name, account_tag) = identity;
            match entitlements {
                Ok(entitlements) => {
                    let items = resolve_items(&entitlements, &bundle.lookup);
                    (account_name, account_tag, items, None)
                }
                Err(error) => (
                    account_name,
                    account_tag,
                    Vec::new(),
                    Some(format!(
                        "Your owned items couldn't load ({error}). Default weapon skins and stats are still available."
                    )),
                ),
            }
        }
        Err(error) => (
            None,
            None,
            Vec::new(),
            Some(format!(
                "Your Riot Client session couldn't be read ({error}). Default weapon skins and stats are still available."
            )),
        ),
    };

    attach_weapon_ids_by_skin_name(&mut items, &bundle.weapons);

    if !catalog_loaded && bundle.weapons.is_empty() && items.is_empty() {
        if let Some(warning) = session_warning {
            return Err(AppError::RiotClient(warning.into()));
        }
        if let Some(warning) = catalog_warning {
            return Err(AppError::Network(warning));
        }
    }

    let counts = count_by_category(&items);
    let totals = catalog_totals(&bundle.lookup);

    if let Some(log) = app_log {
        let orphan_skins = items
            .iter()
            .filter(|item| item.category == "weapon_skins" && item.weapon_id.is_none())
            .count();
        let linked_skins = items
            .iter()
            .filter(|item| item.category == "weapon_skins" && item.weapon_id.is_some())
            .count();
        let unknown_skins = items
            .iter()
            .filter(|item| item.category == "weapon_skins" && item.name == "Unknown item")
            .count();
        let weapons_with_totals = bundle
            .weapons
            .iter()
            .filter(|weapon| weapon.total_skin_count > 0)
            .count();
        let sample: Vec<String> = items
            .iter()
            .filter(|item| item.category == "weapon_skins")
            .take(5)
            .map(|item| {
                format!(
                    "{}[weapon={} skin={}]",
                    item.name,
                    item.weapon_id.as_deref().unwrap_or("-"),
                    item.skin_id.as_deref().unwrap_or(&item.id)
                )
            })
            .collect();
        log.append(
            if orphan_skins > 0 || unknown_skins > 0 {
                "warn"
            } else {
                "debug"
            },
            &format!(
                "[collection] skins linked={linked_skins} orphan={orphan_skins} unknown={unknown_skins} weapons_with_totals={weapons_with_totals}/{} sample={}",
                bundle.weapons.len(),
                sample.join(" | ")
            ),
        );
    }

    Ok(CollectionSnapshotDto {
        account_name,
        account_tag,
        weapons: bundle.weapons,
        items,
        counts,
        totals,
        catalog_loaded,
        catalog_warning,
        session_warning,
    })
}

#[cfg(test)]
mod tests;
