use base64::Engine;

use crate::error::AppError;

const NOT_READY_RETRY_DELAY: std::time::Duration = std::time::Duration::from_secs(2);
const MAX_NOT_READY_RETRIES: u32 = 5;

fn is_not_ready(status: reqwest::StatusCode) -> bool {
    matches!(status.as_u16(), 424 | 464)
}

pub(crate) fn local_client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| AppError::RiotClient(format!("couldn't set up a connection to the riot client ({e})")))
}

pub async fn launch_valorant() -> Result<(), AppError> {
    let client = local_client()?;

    let mut last_error = AppError::RiotClient("couldn't reach the riot client's local api".into());
    for attempt in 0..=MAX_NOT_READY_RETRIES {
        let (port, password) = read_lockfile().await?;
        let auth = base64::engine::general_purpose::STANDARD.encode(format!("riot:{password}"));
        let url = format!("https://127.0.0.1:{port}/product-launcher/v1/products/valorant/patchlines/live");

        let response = match post_launch(&client, &url, &auth).await {
            Ok(response) => response,
            Err(e) => {
                last_error = e;
                if attempt < MAX_NOT_READY_RETRIES {
                    tokio::time::sleep(NOT_READY_RETRY_DELAY).await;
                }
                continue;
            }
        };

        if response.status() == reqwest::StatusCode::LOCKED {
            return Ok(());
        }
        if is_not_ready(response.status()) {
            last_error =
                AppError::RiotClient("the riot client isn't ready yet. make sure you're signed in, then try again".into());
            if attempt < MAX_NOT_READY_RETRIES {
                tokio::time::sleep(NOT_READY_RETRY_DELAY).await;
            }
            continue;
        }
        response
            .error_for_status()
            .map_err(|e| AppError::RiotClient(format!("the riot client's local api rejected the request to open valorant ({e})")))?;
        return Ok(());
    }
    Err(last_error)
}

async fn post_launch(client: &reqwest::Client, url: &str, auth: &str) -> Result<reqwest::Response, AppError> {
    client
        .post(url)
        .header("Authorization", format!("Basic {auth}"))
        .send()
        .await
        .map_err(|e| AppError::RiotClient(format!("couldn't reach the riot client's local api ({e})")))
}

pub(crate) async fn read_lockfile() -> Result<(String, String), AppError> {
    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .ok_or_else(|| AppError::RiotClient("couldn't find your windows user folder (LOCALAPPDATA isn't set)".into()))?;
    let lockfile_path = std::path::Path::new(&local_app_data).join("Riot Games").join("Riot Client").join("Config").join("lockfile");
    let contents = tokio::fs::read_to_string(&lockfile_path).await.map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::RiotClient("riot client's lockfile isn't there. make sure the riot client is running, then try again".into()),
        _ => AppError::RiotClient(format!("couldn't read the riot client's lockfile ({e})")),
    })?;
    let parts: Vec<&str> = contents.trim().split(':').collect();
    let malformed = || AppError::RiotClient("riot client's lockfile looks different than expected. try restarting the riot client".into());
    let port = parts.get(2).ok_or_else(malformed)?;
    let password = parts.get(3).ok_or_else(malformed)?;
    Ok((port.to_string(), password.to_string()))
}
