use std::time::Duration;

use crate::error::AppError;

pub const BASE_URL: &str = "https://valorant-api.com/v1";
const USER_AGENT: &str   = "PrivateAssistant/0.4.0";
const MAX_ATTEMPTS: u32  = 4;
const RETRY_DELAY: Duration = Duration::from_secs(2);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);

pub fn build_client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(REQUEST_TIMEOUT)
        .connect_timeout(Duration::from_secs(20))
        .pool_max_idle_per_host(4)
        .build()
        .map_err(|e| AppError::Network(format!("couldn't set up valorant-api requests ({e})")))
}

pub async fn get_json<T: serde::de::DeserializeOwned>(client: &reqwest::Client, path_with_query: &str) -> Result<T, AppError> {
    let url = format!("{BASE_URL}/{path_with_query}");
    let mut last_error = AppError::Network("couldn't fetch valorant content (unknown error)".into());

    for attempt in 0..MAX_ATTEMPTS {
        match client.get(&url).send().await {
            Ok(response) => {
                let status = response.status();
                if status.as_u16() == 429 || status.is_server_error() {
                    last_error = AppError::Network(format!("valorant content request failed (HTTP {})", status.as_u16()));
                    if attempt + 1 < MAX_ATTEMPTS {
                        tokio::time::sleep(RETRY_DELAY * (attempt + 1)).await;
                        continue;
                    }
                    return Err(last_error);
                }

                let response = match response.error_for_status() {
                    Ok(response) => response,
                    Err(error) => {
                        last_error = AppError::Network(format!("valorant content request failed ({error})"));
                        if attempt + 1 < MAX_ATTEMPTS {
                            tokio::time::sleep(RETRY_DELAY).await;
                            continue;
                        }
                        return Err(last_error);
                    }
                };

                return response
                    .json::<T>()
                    .await
                    .map_err(|e| AppError::Network(format!("couldn't parse valorant-api response ({e})")));
            }
            Err(error) => {
                last_error = AppError::Network(format!("couldn't fetch valorant content ({error})"));
                if attempt + 1 < MAX_ATTEMPTS {
                    tokio::time::sleep(RETRY_DELAY * (attempt + 1)).await;
                    continue;
                }
            }
        }
    }

    Err(last_error)
}