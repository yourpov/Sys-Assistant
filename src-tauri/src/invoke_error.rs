use serde::Serialize;

use crate::error::{AppError, RiotClientError};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvokeErrorDto {
    pub code : String,
    pub title: String,
    pub body : String,
    pub log  : String,
}

pub fn invoke_err(e: AppError) -> InvokeErrorDto {
    InvokeErrorDto::from(e)
}

pub fn invoke_err_msg(code: &str, title: &str, body: &str, log: impl Into<String>) -> InvokeErrorDto {
    InvokeErrorDto {
        code : code.to_string(),
        title: title.to_string(),
        body : body.to_string(),
        log  : log.into(),
    }
}

pub fn sign_in_required() -> InvokeErrorDto {
    invoke_err_msg(
        "sign_in_required",
        "Sign-in required",
        "Sign in with Discord or continue as guest from the profile menu, then try again.",
        "sign in required",
    )
}

pub fn henrik_api_key_missing() -> InvokeErrorDto {
    invoke_err_msg(
        "henrik_api_key_missing",
        "Your lookup couldn't run",
        "Add a free HenrikDev API key in Settings, Tools, then try again.",
        "henrikdev api key missing",
    )
}

impl InvokeErrorDto {
    pub fn unknown(log: impl Into<String>) -> Self {
        let log = log.into();
        invoke_err_msg(
            "unknown",
            "That didn't work",
            "Something blocked this step. Try again. If it keeps failing, open Developer logs in Settings, About, Developer.",
            log,
        )
    }
}

impl From<AppError> for InvokeErrorDto {
    fn from(error: AppError) -> Self {
        let log = error.to_string();
        match error {
            AppError::Cancelled => invoke_err_msg(
                "cancelled",
                "Cancelled",
                "This step was stopped before it finished.",
                log,
            ),
            AppError::FileMissing(name) => invoke_err_msg(
                "file_missing",
                &format!("Your {name} file couldn't be found"),
                &format!("Place {name} beside the app or set its path in Settings, Automation, Files Locations, then try again."),
                log,
            ),
            AppError::Launch(target, _) => invoke_err_msg(
                "launch_failed",
                &format!("{target} couldn't start"),
                "Close other copies if one is already open, then try again.",
                log,
            ),
            AppError::RiotClient(ref riot_error) => riot_client_invoke(riot_error, log),
            AppError::Network(message) => network_invoke(&message, log),
            AppError::Registry(_) => invoke_err_msg(
                "registry_failed",
                "A Windows setting couldn't be updated",
                "Run the app as administrator or change the setting manually in Windows, then try again.",
                log,
            ),
            AppError::Settings(_) => invoke_err_msg(
                "settings_failed",
                "Your settings couldn't be saved",
                "Check that the app can write to its config folder, then try again.",
                log,
            ),
            AppError::Account(message) => account_invoke(&message, log),
            AppError::Service(message) => invoke_err_msg(
                "service_failed",
                "A Windows service step failed",
                if message.contains("Vanguard") {
                    "Install or repair Riot Vanguard, then try again."
                } else {
                    "Restart the related service from Windows Services, then try again."
                },
                log,
            ),
            AppError::Input(message) => input_invoke(&message, log),
        }
    }
}

fn parse_http_status(lower: &str) -> Option<u16> {
    for token in lower.split(|c: char| !c.is_ascii_digit()) {
        if token.len() == 3 {
            if let Ok(code) = token.parse::<u16>() {
                if (100..600).contains(&code) {
                    return Some(code);
                }
            }
        }
    }
    None
}

fn remote_service_body(lower: &str) -> &'static str {
    if lower.contains("timeout") || lower.contains("timed out") || lower.contains("deadline") {
        return "The service didn't respond in time. Try again in a moment.";
    }

    if let Some(status) = parse_http_status(lower) {
        return match status {
            401 | 403 => "You may need to sign in again, then try again.",
            404 => "The requested item wasn't found.",
            429 => "Too many requests. Wait a minute and try again.",
            500..=599 => "The service is having trouble right now. Try again in a moment.",
            _ => "Something went wrong with the service. Try again in a moment.",
        };
    }

    if lower.contains("connection refused")
        || lower.contains("connection reset")
        || lower.contains("failed to connect")
        || lower.contains("dns error")
        || lower.contains("name or service not known")
        || lower.contains("no such host")
    {
        return "The service couldn't be reached. It may be down. Try again in a moment.";
    }

    "The request couldn't finish. Try again in a moment."
}

fn valorant_content_invoke(log: String) -> InvokeErrorDto {
    let lower = log.to_ascii_lowercase();
    let body = if lower.contains("client version") {
        "Open Valorant once so the app can read your game version, then try again."
    } else if lower.contains("timeout") || lower.contains("timed out") || lower.contains("deadline") {
        remote_service_body(&lower)
    } else {
        "valorant-api.com couldn't be reached. Try again in a moment."
    };
    invoke_err_msg("valorant_api_failed", "Cosmetic names and icons couldn't load", body, log)
}

fn henrik_lookup_invoke(lower: &str, log: String) -> Option<InvokeErrorDto> {
    if lower.contains("player not found") {
        return Some(invoke_err_msg(
            "player_not_found",
            "That player wasn't found",
            "Check the name and tag, then try again.",
            log,
        ));
    }

    if lower.contains("couldn't reach the api") || lower.contains("api error") || lower.contains("couldn't read the api") {
        return Some(invoke_err_msg(
            "henrik_lookup_failed",
            "Your lookup couldn't finish",
            remote_service_body(lower),
            log,
        ));
    }

    None
}

fn riot_client_invoke(error: &RiotClientError, log: String) -> InvokeErrorDto {
    match error {
        RiotClientError::LockfileMissing | RiotClientError::NotRunning => invoke_err_msg(
            "riot_client_not_running",
            "Your Riot Client isn't open",
            "Start the Riot Client and sign in, then try again. Valorant does not need to be open.",
            log,
        ),
        RiotClientError::NotReady | RiotClientError::Rejected(401) | RiotClientError::Rejected(403) => invoke_err_msg(
            "riot_client_not_signed_in",
            "Your Riot sign-in isn't ready",
            "Wait until the Riot Client home screen is fully loaded, then try again.",
            log,
        ),
        RiotClientError::Unreachable(_) => invoke_err_msg(
            "riot_client_unreachable",
            "Your Riot Client is not open",
            "Restart the Riot Client, then try again.",
            log,
        ),
        RiotClientError::OwnedItemsFailed(_) => invoke_err_msg(
            "riot_owned_items_failed",
            "Your owned items couldn't load",
            "Stay signed in to the Riot Client and try again.",
            log,
        ),
        RiotClientError::Other(message) => riot_client_other_invoke(message, log),
        RiotClientError::LockfileMalformed | RiotClientError::Rejected(_) | RiotClientError::NotInMatch => invoke_err_msg(
            "riot_client_failed",
            "Your Riot Client step couldn't finish",
            "Restart the Riot Client, then try again.",
            log,
        ),
    }
}

fn riot_client_other_invoke(message: &str, log: String) -> InvokeErrorDto {
    let lower = message.to_ascii_lowercase();

    if lower.contains("couldn't reach the riot api") {
        return invoke_err_msg(
            "riot_owned_items_failed",
            "Your owned items couldn't load",
            "Stay signed in to the Riot Client and try again.",
            log,
        );
    }

    if lower.contains("valorant-api") || lower.contains("valorant content") {
        return valorant_content_invoke(log);
    }

    if lower.contains("couldn't determine the valorant client version") {
        return invoke_err_msg(
            "valorant_version_missing",
            "Your Valorant version couldn't be read",
            "Open Valorant once so the app can read your game version, then try again.",
            log,
        );
    }

    if lower.contains("never finished signing in") || lower.contains("sign in fresh") {
        return invoke_err_msg(
            "riot_client_not_signed_in",
            "Your Riot sign-in didn't finish",
            "Wait for the Riot Client home screen, or forget the saved session and sign in fresh for that account, then try again.",
            log,
        );
    }

    invoke_err_msg(
        "riot_client_failed",
        "Your Riot Client step couldn't finish",
        "Restart the Riot Client, then try again.",
        log,
    )
}

fn network_invoke(message: &str, log: String) -> InvokeErrorDto {
    let lower = message.to_ascii_lowercase();

    if lower.contains("henrikdev api key") || lower.contains("no henrikdev api key") {
        return henrik_api_key_missing();
    }

    if lower.contains("api key is invalid") {
        return invoke_err_msg(
            "henrik_api_key_invalid",
            "Your API key was rejected",
            "Check the key in Settings, Tools and paste a fresh one from the HenrikDev dashboard, then try again.",
            log,
        );
    }

    if lower.contains("rate limit") || lower.contains("429") {
        return invoke_err_msg(
            "henrik_rate_limited",
            "Your lookup was rate limited",
            "Wait a minute or add another HenrikDev API key in Settings, Tools, then try again.",
            log,
        );
    }

    if let Some(dto) = henrik_lookup_invoke(&lower, log.clone()) {
        return dto;
    }

    if lower.contains("valorant-api")
        || lower.contains("valorant content")
        || lower.contains("valorant client version")
    {
        return valorant_content_invoke(log);
    }

    if lower.contains("collection cache") {
        return invoke_err_msg(
            "collection_cache_failed",
            "Your collection cache couldn't be read",
            "Try again. The app will refresh cosmetic data from the server.",
            log,
        );
    }

    if lower.contains("lanyard") {
        return invoke_err_msg(
            "lanyard_failed",
            "Discord status couldn't load",
            remote_service_body(&lower),
            log,
        );
    }

    if lower.contains("agent list") {
        return invoke_err_msg(
            "agent_list_failed",
            "Agent names couldn't load",
            remote_service_body(&lower),
            log,
        );
    }

    if lower.contains("community configs") {
        return invoke_err_msg(
            "community_configs_failed",
            "The community configs board couldn't load",
            remote_service_body(&lower),
            log,
        );
    }

    if lower.contains("comment") {
        return invoke_err_msg(
            "community_comment_failed",
            "Your comment couldn't be saved",
            remote_service_body(&lower),
            log,
        );
    }

    if lower.contains("reaction") {
        return invoke_err_msg(
            "community_reaction_failed",
            "Your reaction couldn't be saved",
            remote_service_body(&lower),
            log,
        );
    }

    if lower.contains("config") && (lower.contains("post") || lower.contains("update") || lower.contains("delete") || lower.contains("rejected")) {
        return invoke_err_msg(
            "community_config_failed",
            "Your config couldn't be saved",
            remote_service_body(&lower),
            log,
        );
    }

    if lower.contains("changelog") {
        return invoke_err_msg(
            "changelog_failed",
            "The changelog couldn't load",
            remote_service_body(&lower),
            log,
        );
    }

    if lower.contains("discord sign-in") || lower.contains("sign-in didn't return") || lower.contains("no sign-in was in progress") {
        return invoke_err_msg(
            "discord_sign_in_failed",
            "Discord sign-in couldn't finish",
            "Close the sign-in window and try again from the profile menu.",
            log,
        );
    }

    if lower.contains("sign-in") && (lower.contains("rejected") || lower.contains("couldn't reach")) {
        return invoke_err_msg(
            "discord_sign_in_failed",
            "Discord sign-in couldn't finish",
            remote_service_body(&lower),
            log,
        );
    }

    if lower.contains("feedback") || lower.contains("suggestion") {
        return invoke_err_msg(
            "feedback_failed",
            "Your feedback couldn't be sent",
            remote_service_body(&lower),
            log,
        );
    }

    if lower.contains("couldn't reach") || lower.contains("couldn't fetch") || lower.contains("couldn't load") || lower.contains("couldn't read") {
        return invoke_err_msg(
            "remote_service_failed",
            "That request couldn't finish",
            remote_service_body(&lower),
            log,
        );
    }

    invoke_err_msg(
        "network_failed",
        "That request couldn't finish",
        remote_service_body(&lower),
        log,
    )
}

fn account_invoke(message: &str, log: String) -> InvokeErrorDto {
    let lower = message.to_ascii_lowercase();

    if lower.contains("already exists") {
        return invoke_err_msg(
            "account_duplicate",
            "That account is already saved",
            "Edit the existing entry or remove it before adding it again.",
            log,
        );
    }

    if lower.contains("no longer exists") {
        return invoke_err_msg(
            "account_not_found",
            "That account is no longer saved",
            "Refresh the list and try again.",
            log,
        );
    }

    if lower.contains("no accounts chosen") || lower.contains("account swap") {
        return invoke_err_msg(
            "account_swap_empty",
            "Account Swap has no accounts selected",
            "Pick at least one account in Settings, Automation, Account Swap, then try again.",
            log,
        );
    }

    if lower.contains("password") || lower.contains("secure storage") || lower.contains("credential") {
        return invoke_err_msg(
            "account_password_failed",
            "That account password couldn't be accessed",
            "Re-enter the password on the Accounts page, then try again.",
            log,
        );
    }

    if lower.contains("expected username:password") || lower.contains("unterminated") || lower.contains("username is empty") || lower.contains("password is empty") {
        return invoke_err_msg(
            "account_import_invalid",
            "That import line isn't valid",
            "Use user:pass or user:pass | Name#Tag on each line, then try again.",
            log,
        );
    }

    invoke_err_msg(
        "account_failed",
        "That account step couldn't finish",
        "Try again. If it keeps failing, open Developer logs in Settings, About, Developer.",
        log,
    )
}

fn input_invoke(message: &str, log: String) -> InvokeErrorDto {
    let lower = message.to_ascii_lowercase();

    if lower.contains("sign in") {
        return sign_in_required();
    }

    if lower.contains("reaction") {
        return invoke_err_msg(
            "community_reaction_invalid",
            "That reaction isn't valid",
            "Use like or dislike, then try again.",
            log,
        );
    }

    if lower.contains("comment") || lower.contains("title") || lower.contains("description") || lower.contains("config") {
        return invoke_err_msg(
            "input_invalid",
            "That entry isn't valid",
            message,
            log,
        );
    }

    invoke_err_msg(
        "input_invalid",
        "That entry isn't valid",
        "Check the fields and try again.",
        log,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::{AppError, RiotClientError};

    #[test]
    fn valorant_content_timeout_does_not_blame_internet() {
        let dto = InvokeErrorDto::from(AppError::Network(
            "couldn't fetch valorant content (operation timed out)".into(),
        ));
        assert_eq!(dto.code, "valorant_api_failed");
        assert!(!dto.body.to_ascii_lowercase().contains("internet"));
        assert!(dto.body.contains("didn't respond in time"));
    }

    #[test]
    fn henrik_player_not_found_is_specific() {
        let dto = InvokeErrorDto::from(AppError::Network("player not found".into()));
        assert_eq!(dto.code, "player_not_found");
        assert!(dto.title.contains("wasn't found"));
    }

    #[test]
    fn henrik_api_error_uses_service_message() {
        let dto = InvokeErrorDto::from(AppError::Network("api error (503)".into()));
        assert_eq!(dto.code, "henrik_lookup_failed");
        assert!(dto.body.contains("having trouble"));
    }

    #[test]
    fn community_configs_rejection_uses_service_message() {
        let dto = InvokeErrorDto::from(AppError::Network(
            "the community configs board rejected this (status 503)".into(),
        ));
        assert_eq!(dto.code, "community_configs_failed");
        assert!(!dto.body.to_ascii_lowercase().contains("internet"));
    }

    #[test]
    fn generic_network_fallback_avoids_internet_blame() {
        let dto = InvokeErrorDto::from(AppError::Network("something unexpected happened".into()));
        assert_eq!(dto.code, "network_failed");
        assert!(!dto.body.to_ascii_lowercase().contains("internet"));
    }

    #[test]
    fn lockfile_missing_is_classified_as_client_not_running() {
        let dto = InvokeErrorDto::from(AppError::RiotClient(RiotClientError::LockfileMissing));
        assert_eq!(dto.code, "riot_client_not_running");
    }

    #[test]
    fn not_ready_is_classified_as_not_signed_in() {
        let dto = InvokeErrorDto::from(AppError::RiotClient(RiotClientError::NotReady));
        assert_eq!(dto.code, "riot_client_not_signed_in");
    }

    #[test]
    fn rejected_401_is_also_classified_as_not_signed_in() {
        let dto = InvokeErrorDto::from(AppError::RiotClient(RiotClientError::Rejected(401)));
        assert_eq!(dto.code, "riot_client_not_signed_in");
    }

    #[test]
    fn rejected_other_status_falls_back_to_generic_riot_client_failure() {
        let dto = InvokeErrorDto::from(AppError::RiotClient(RiotClientError::Rejected(500)));
        assert_eq!(dto.code, "riot_client_failed");
    }

    #[test]
    fn unreachable_is_classified_distinctly_from_not_running() {
        let dto = InvokeErrorDto::from(AppError::RiotClient(RiotClientError::Unreachable("connection refused".into())));
        assert_eq!(dto.code, "riot_client_unreachable");
    }

    #[test]
    fn owned_items_failed_has_its_own_category() {
        let dto = InvokeErrorDto::from(AppError::RiotClient(RiotClientError::OwnedItemsFailed("HTTP 500".into())));
        assert_eq!(dto.code, "riot_owned_items_failed");
    }

    #[test]
    fn other_still_falls_back_to_substring_classification_for_the_long_tail() {
        let dto = InvokeErrorDto::from(AppError::RiotClient(RiotClientError::Other(
            "valorant-api.com: request failed".into(),
        )));
        assert_eq!(dto.code, "valorant_api_failed");
    }
}