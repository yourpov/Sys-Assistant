use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::domain::{Account, CheckOutcome, IssueReport, ManualAction, Settings, WorkflowAction};

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkflowActionDto {
    Start,
    CloseAll,
}

impl From<WorkflowActionDto> for WorkflowAction {
    fn from(dto: WorkflowActionDto) -> Self {
        match dto {
            WorkflowActionDto::Start => WorkflowAction::Start,
            WorkflowActionDto::CloseAll => WorkflowAction::CloseAll,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ManualActionDto {
    ToggleValorant,
    ToggleRiotClient,
    OpenLoader,
    ChangeSeed,
    OpenEmuInstaller,
    RestartValorant,
    #[serde(other)]
    Unknown,
}

impl ManualActionDto {
    pub fn into_action(self) -> Option<ManualAction> {
        match self {
            ManualActionDto::ToggleValorant => Some(ManualAction::ToggleValorant),
            ManualActionDto::ToggleRiotClient => Some(ManualAction::ToggleRiotClient),
            ManualActionDto::OpenLoader => Some(ManualAction::OpenLoader),
            ManualActionDto::ChangeSeed => Some(ManualAction::ChangeSeed),
            ManualActionDto::OpenEmuInstaller => Some(ManualAction::OpenEmuInstaller),
            ManualActionDto::RestartValorant => Some(ManualAction::RestartValorant),
            ManualActionDto::Unknown => None,
        }
    }
}

impl From<ManualAction> for ManualActionDto {
    fn from(action: ManualAction) -> Self {
        match action {
            ManualAction::ToggleValorant => ManualActionDto::ToggleValorant,
            ManualAction::ToggleRiotClient => ManualActionDto::ToggleRiotClient,
            ManualAction::OpenLoader => ManualActionDto::OpenLoader,
            ManualAction::ChangeSeed => ManualActionDto::ChangeSeed,
            ManualAction::OpenEmuInstaller => ManualActionDto::OpenEmuInstaller,
            ManualAction::RestartValorant => ManualActionDto::RestartValorant,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueReportDto {
    pub riot_running   : bool,
    pub stay_signed_in : bool,
    pub missing_files  : Vec<String>,
}

impl From<&IssueReport> for IssueReportDto {
    fn from(report: &IssueReport) -> Self {
        Self {
            riot_running   : report.riot_running,
            stay_signed_in : report.stay_signed_in,
            missing_files  : report.missing_files.clone(),
        }
    }
}

impl From<IssueReportDto> for IssueReport {
    fn from(dto: IssueReportDto) -> Self {
        Self {
            riot_running   : dto.riot_running,
            stay_signed_in : dto.stay_signed_in,
            missing_files  : dto.missing_files,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CheckOutcomeDto {
    NeedsReboot,
    Report { report: IssueReportDto },
}

impl From<CheckOutcome> for CheckOutcomeDto {
    fn from(outcome: CheckOutcome) -> Self {
        match outcome {
            CheckOutcome::NeedsReboot => CheckOutcomeDto::NeedsReboot,
            CheckOutcome::Report(report) => CheckOutcomeDto::Report { report: IssueReportDto::from(&report) },
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogLineDto {
    pub level   : &'static str,
    pub message : String,
    pub replace : bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsDto {
    pub emu_path                           : Option<String>,
    pub loader_path                        : Option<String>,
    pub is_always_on_top                   : bool,
    pub insert_sim_enabled                 : bool,
    pub insert_sim_keybind                 : Option<String>,
    pub manual_actions_enabled             : Vec<ManualActionDto>,
    pub account_swap_pool                  : Vec<String>,
    pub henrik_api_keys                    : Vec<String>,
    pub install_emu_on_riot_launch_enabled : bool,
    pub auto_fix_55_enabled                    : bool,
    pub toast_os_notifications_enabled     : bool,
    pub confirm_before_actions_enabled     : bool,
    pub hide_account_usernames             : bool,
    pub reduce_animations_enabled          : bool,
    pub mute_alert_sounds_enabled          : bool,
    pub accent_color                       : Option<String>,
}

impl From<&Settings> for SettingsDto {
    fn from(settings: &Settings) -> Self {
        Self {
            emu_path                           : settings.emu_path.as_ref().map(|p| p.display().to_string()),
            loader_path                        : settings.loader_path.as_ref().map(|p| p.display().to_string()),
            is_always_on_top                   : settings.is_always_on_top,
            insert_sim_enabled                 : settings.insert_sim_enabled,
            insert_sim_keybind                 : settings.insert_sim_keybind.clone(),
            manual_actions_enabled             : settings.manual_actions_enabled.iter().map(|a| (*a).into()).collect(),
            account_swap_pool                  : settings.account_swap_pool.clone(),
            henrik_api_keys                    : settings.henrik_api_keys.clone(),
            install_emu_on_riot_launch_enabled : settings.install_emu_on_riot_launch_enabled,
            auto_fix_55_enabled                    : settings.auto_fix_55_enabled,
            toast_os_notifications_enabled     : settings.toast_os_notifications_enabled,
            confirm_before_actions_enabled     : settings.confirm_before_actions_enabled,
            hide_account_usernames             : settings.hide_account_usernames,
            reduce_animations_enabled          : settings.reduce_animations_enabled,
            mute_alert_sounds_enabled          : settings.mute_alert_sounds_enabled,
            accent_color                       : settings.accent_color.clone(),
        }
    }
}

impl From<SettingsDto> for Settings {
    fn from(dto: SettingsDto) -> Self {
        Self {
            emu_path                           : dto.emu_path.map(PathBuf::from),
            loader_path                        : dto.loader_path.map(PathBuf::from),
            is_always_on_top                   : dto.is_always_on_top,
            insert_sim_enabled                 : dto.insert_sim_enabled,
            insert_sim_keybind                 : dto.insert_sim_keybind,
            manual_actions_enabled             : dto.manual_actions_enabled.into_iter().filter_map(ManualActionDto::into_action).collect(),
            account_swap_pool                  : dto.account_swap_pool,
            henrik_api_keys                    : dto.henrik_api_keys,
            install_emu_on_riot_launch_enabled : dto.install_emu_on_riot_launch_enabled,
            auto_fix_55_enabled                    : dto.auto_fix_55_enabled,
            toast_os_notifications_enabled     : dto.toast_os_notifications_enabled,
            confirm_before_actions_enabled     : dto.confirm_before_actions_enabled,
            hide_account_usernames             : dto.hide_account_usernames,
            reduce_animations_enabled          : dto.reduce_animations_enabled,
            mute_alert_sounds_enabled          : dto.mute_alert_sounds_enabled,
            accent_color                       : dto.accent_color,
            ..Settings::default()
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountDto {
    pub id          : String,
    pub label       : String,
    pub username    : String,
    pub has_session : bool,
    pub notes       : Option<String>,
    pub full_access : bool,
    pub category    : Option<String>,
    pub region      : Option<String>,
}

impl From<Account> for AccountDto {
    fn from(account: Account) -> Self {
        Self {
            id          : account.id,
            label       : account.label,
            username    : account.username,
            has_session : false,
            notes       : account.notes,
            full_access : account.full_access,
            category    : account.category,
            region      : account.region,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAccountsResultDto {
    pub added              : Vec<AccountDto>,
    pub skipped_duplicates : u32,
    pub errors             : Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportAccountsResultDto {
    pub exported : u32,
    pub errors   : Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountLookupExtrasDto {
    pub games_played   : i64,
    pub win_rate       : i64,
    pub kda            : f64,
    pub avg_hs_percent : i64,
    pub total_kills    : i64,
    pub total_deaths   : i64,
    pub total_assists  : i64,
    pub top_agents     : Vec<AgentSummaryDto>,
    pub recent_matches : Vec<MatchSummaryDto>,
    pub seasons        : Vec<SeasonStatsDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountLookupDto {
    pub name           : String,
    pub tag            : String,
    pub region         : String,
    pub account_level  : u32,
    pub card_url       : String,
    pub last_update    : String,
    pub rank           : Option<String>,
    pub rank_icon_url  : Option<String>,
    pub rr             : Option<i64>,
    pub elo            : Option<i64>,
    pub peak_rank      : Option<String>,
    pub games_played   : i64,
    pub win_rate       : i64,
    pub kda            : f64,
    pub avg_hs_percent : i64,
    pub total_kills    : i64,
    pub total_deaths   : i64,
    pub total_assists  : i64,
    pub top_agents     : Vec<AgentSummaryDto>,
    pub recent_matches : Vec<MatchSummaryDto>,
    pub seasons        : Vec<SeasonStatsDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonStatsDto {
    pub season_id             : String,
    pub season_label          : String,
    pub rank                  : String,
    pub wins                  : i64,
    pub games                 : i64,
    pub win_rate              : i64,
    pub leaderboard_placement : Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSummaryDto {
    pub agent          : String,
    pub agent_icon_url : String,
    pub games          : i64,
    pub wins           : i64,
    pub kills          : i64,
    pub deaths         : i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchSummaryDto {
    pub map            : String,
    pub map_icon_url   : String,
    pub mode           : String,
    pub date           : i64,
    pub result         : String,
    pub kills          : i64,
    pub deaths         : i64,
    pub assists        : i64,
    pub hs_percent     : i64,
    pub team_score     : i64,
    pub enemy_score    : i64,
    pub agent          : String,
    pub agent_icon_url : String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchInfoDto {
    pub in_game : bool,
    pub players : Vec<MatchPlayerDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValorantVersionDto {
    pub branch              : String,
    pub game_version        : String,
    pub build_number        : u32,
    pub riot_client_version : String,
    pub label               : String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValorantVersionStatusDto {
    pub latest : Option<ValorantVersionDto>,
    pub local  : Option<ValorantVersionDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveMatchSnapshotDto {
    pub in_match         : bool,
    pub map_name         : Option<String>,
    pub region           : Option<String>,
    pub rounds_completed : u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthSessionDto {
    pub user_id            : String,
    pub discord_username   : Option<String>,
    pub discord_avatar_url : Option<String>,
    pub is_guest           : bool,
}

impl From<crate::infrastructure::discord_auth::AuthSession> for AuthSessionDto {
    fn from(session: crate::infrastructure::discord_auth::AuthSession) -> Self {
        Self {
            user_id            : session.user_id,
            discord_username   : session.discord_username,
            discord_avatar_url : session.discord_avatar_url,
            is_guest           : session.is_guest,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedPlayerDto {
    pub id             : String,
    pub name           : String,
    pub tag            : String,
    pub rank           : Option<String>,
    pub rr             : Option<i64>,
    pub rank_icon_url  : Option<String>,
    pub agent          : Option<String>,
    pub agent_icon_url : Option<String>,
    pub saved_at       : String,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionCategoryCountsDto {
    pub weapon_skins : u32,
    pub gun_buddies  : u32,
    pub player_cards : u32,
    pub sprays       : u32,
    pub titles       : u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionWeaponDto {
    pub id                       : String,
    pub name                     : String,
    pub icon_url                 : Option<String>,
    pub default_skin_id          : String,
    pub default_skin_name        : String,
    pub default_skin_icon_url    : Option<String>,
    pub default_skin_preview_url : Option<String>,
    pub weapon_class             : String,
    pub sort_order               : i32,
    pub fire_rate                : Option<f64>,
    pub magazine_size            : Option<i32>,
    pub reload_time_seconds      : Option<f64>,
    pub equip_time_seconds       : Option<f64>,
    pub wall_penetration         : Option<String>,
    pub head_damage              : Option<f64>,
    pub body_damage              : Option<f64>,
    pub shop_cost                : Option<i32>,
    pub total_skin_count         : u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSkinVariantDto {
    pub id           : String,
    pub display_name : String,
    pub icon_url     : Option<String>,
    pub preview_url  : Option<String>,
    pub swatch_url   : Option<String>,
    pub video_url    : Option<String>,
    pub owned        : bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionItemDto {
    pub id                : String,
    pub name              : String,
    pub icon_url          : Option<String>,
    pub preview_url       : Option<String>,
    pub category          : String,
    pub weapon_id         : Option<String>,
    pub skin_id           : Option<String>,
    pub content_tier_uuid : Option<String>,
    pub is_default        : bool,
    #[serde(default)]
    pub variants          : Vec<CollectionSkinVariantDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RiotClientStatusDto {
    pub running   : bool,
    pub logged_in : bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSnapshotDto {
    pub account_name    : Option<String>,
    pub account_tag     : Option<String>,
    pub weapons         : Vec<CollectionWeaponDto>,
    pub items           : Vec<CollectionItemDto>,
    pub counts          : CollectionCategoryCountsDto,
    pub totals          : CollectionCategoryCountsDto,
    pub catalog_loaded  : bool,
    pub catalog_warning : Option<String>,
    pub session_warning : Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchPlayerDto {
    pub name           : String,
    pub tag            : String,
    pub rank           : Option<String>,
    pub rr             : Option<i64>,
    pub rank_icon_url  : Option<String>,
    pub team_side      : Option<String>,
    pub ally           : bool,
    pub agent          : Option<String>,
    pub agent_icon_url : Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppCreditDto {
    pub username            : String,
    pub display_name        : String,
    pub avatar_data_url     : String,
    pub decoration_data_url : Option<String>,
    pub status              : String,
    pub activity_text       : Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityConfigDto {
    pub id                 : String,
    pub name               : String,
    pub note               : Option<String>,
    pub data               : serde_json::Value,
    #[serde(rename = "type")]
    pub config_type        : Option<String>,
    pub perspective        : Option<String>,
    pub user_id            : Option<String>,
    pub discord_username   : Option<String>,
    pub discord_avatar_url : Option<String>,
    pub likes              : i64,
    pub dislikes           : i64,
    pub comment_count      : i64,
    pub created_at         : String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityCommentDto {
    pub id                 : String,
    pub user_id            : Option<String>,
    pub parent_id          : Option<String>,
    pub discord_username   : Option<String>,
    pub discord_avatar_url : Option<String>,
    pub body               : String,
    pub reply_count        : i64,
    pub created_at         : String,
    pub updated_at         : String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentsPageDto {
    pub comments    : Vec<CommunityCommentDto>,
    pub has_more    : bool,
    pub total_count : Option<i64>,
}
