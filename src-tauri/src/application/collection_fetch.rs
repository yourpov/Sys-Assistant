use std::path::Path;

use crate::dto::CollectionSnapshotDto;
use crate::error::AppError;
use crate::infrastructure::app_log::AppLogStore;
use crate::infrastructure::collection;

pub async fn fetch(config_dir: &Path, app_log: Option<&AppLogStore>) -> Result<CollectionSnapshotDto, AppError> {
    collection::fetch_collection(config_dir, app_log).await
}