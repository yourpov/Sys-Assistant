use std::path::Path;

use tokio::io::AsyncWriteExt;

use crate::application::ports::{Downloader, EventSink};
use crate::error::AppError;

pub struct HttpDownloader;

#[async_trait::async_trait]
impl Downloader for HttpDownloader {
    async fn download(&self, url: &str, destination: &Path, _sink: &dyn EventSink) -> Result<(), AppError> {
        let response = reqwest::get(url).await.map_err(|e| AppError::Network(format!("couldn't reach {url} ({e})")))?;
        let bytes = response.bytes().await.map_err(|e| AppError::Network(format!("the download from {url} was interrupted ({e})")))?;

        let mut file = tokio::fs::File::create(destination)
            .await
            .map_err(|e| AppError::Network(format!("couldn't save the download to {} ({e})", destination.display())))?;
        file.write_all(&bytes)
            .await
            .map_err(|e| AppError::Network(format!("couldn't save the download to {} ({e})", destination.display())))
    }
}
