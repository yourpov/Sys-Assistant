use crate::dto::{AccountLookupDto, AccountLookupExtrasDto, LiveMatchSnapshotDto, MatchInfoDto, ValorantVersionStatusDto};
use crate::error::AppError;
use crate::infrastructure::{henrik, match_info, valorant_version};
use crate::infrastructure::match_info::MatchFetchPhase;

pub async fn lookup_account(api_keys: &[String], name: &str, tag: &str) -> Result<AccountLookupDto, AppError> {
    henrik::fetch_account_lookup(api_keys, name, tag).await
}

pub async fn lookup_account_profile(api_keys: &[String], name: &str, tag: &str) -> Result<AccountLookupDto, AppError> {
    henrik::fetch_account_profile(api_keys, name, tag).await
}

pub async fn lookup_account_extras(
    api_keys: &[String],
    name    : &str,
    tag     : &str,
    region  : &str,
) -> Result<AccountLookupExtrasDto, AppError> {
    henrik::fetch_account_extras(api_keys, name, tag, region).await
}

pub async fn fetch_match_info(api_keys: &[String], phase: MatchFetchPhase) -> Result<MatchInfoDto, AppError> {
    match_info::fetch_live_match(api_keys, phase).await
}

pub async fn detect_current_account(api_keys: &[String]) -> Result<AccountLookupDto, AppError> {
    let (name, tag) = match_info::detect_current_riot_id(api_keys).await?;
    henrik::fetch_account_lookup(api_keys, &name, &tag).await
}

pub async fn detect_current_account_profile(api_keys: &[String]) -> Result<AccountLookupDto, AppError> {
    let (name, tag) = match_info::detect_current_riot_id(api_keys).await?;
    henrik::fetch_account_profile(api_keys, &name, &tag).await
}

pub async fn fetch_live_match_snapshot() -> Result<LiveMatchSnapshotDto, AppError> {
    Ok(match_info::fetch_live_match_snapshot().await)
}

pub async fn fetch_valorant_version_status() -> Result<ValorantVersionStatusDto, AppError> {
    let (latest, local) = valorant_version::fetch_version_status().await;
    if latest.is_none() && local.is_none() {
        return Err(AppError::Network("couldn't fetch valorant version status".into()));
    }
    Ok(ValorantVersionStatusDto { latest, local })
}