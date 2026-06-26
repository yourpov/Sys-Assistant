use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::domain::{Account, CheckOutcome, IssueReport, ManualAction, Settings, WorkflowAction};

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkflowActionDto {
    StartWithRestart,
    StartWithoutRestart,
    Fix55Error,
    CloseAll,
}

impl From<WorkflowActionDto> for WorkflowAction {
    fn from(dto: WorkflowActionDto) -> Self {
        match dto {
            WorkflowActionDto::StartWithRestart => WorkflowAction::StartWithRestart,
            WorkflowActionDto::StartWithoutRestart => WorkflowAction::StartWithoutRestart,
            WorkflowActionDto::Fix55Error => WorkflowAction::Fix55Error,
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
    CreateSession,
}

impl From<ManualActionDto> for ManualAction {
    fn from(dto: ManualActionDto) -> Self {
        match dto {
            ManualActionDto::ToggleValorant => ManualAction::ToggleValorant,
            ManualActionDto::ToggleRiotClient => ManualAction::ToggleRiotClient,
            ManualActionDto::OpenLoader => ManualAction::OpenLoader,
            ManualActionDto::ChangeSeed => ManualAction::ChangeSeed,
            ManualActionDto::OpenEmuInstaller => ManualAction::OpenEmuInstaller,
            ManualActionDto::RestartValorant => ManualAction::RestartValorant,
            ManualActionDto::CreateSession => ManualAction::CreateSession,
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
            ManualAction::CreateSession => ManualActionDto::CreateSession,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueReportDto {
    pub riot_running: bool,
    pub stay_signed_in: bool,
    pub core_isolation_enabled: bool,
    pub missing_files: Vec<String>,
}

impl From<&IssueReport> for IssueReportDto {
    fn from(report: &IssueReport) -> Self {
        Self {
            riot_running: report.riot_running,
            stay_signed_in: report.stay_signed_in,
            core_isolation_enabled: report.core_isolation_enabled,
            missing_files: report.missing_files.clone(),
        }
    }
}

impl From<IssueReportDto> for IssueReport {
    fn from(dto: IssueReportDto) -> Self {
        Self {
            riot_running: dto.riot_running,
            stay_signed_in: dto.stay_signed_in,
            core_isolation_enabled: dto.core_isolation_enabled,
            missing_files: dto.missing_files,
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
    pub level: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsDto {
    pub temp_val_wait_secs: u64,
    pub sesh_wait_secs: u64,
    pub emu_path: Option<String>,
    pub loader_path: Option<String>,
    pub sesh_path: Option<String>,
    pub is_always_on_top: bool,
    pub insert_sim_enabled: bool,
    pub insert_sim_keybind: Option<String>,
    pub manual_actions_enabled: Vec<ManualActionDto>,
    pub account_swap_pool: Vec<String>,
    pub henrik_api_keys: Vec<String>,
}

impl From<&Settings> for SettingsDto {
    fn from(settings: &Settings) -> Self {
        Self {
            temp_val_wait_secs: settings.temp_val_wait.as_secs(),
            sesh_wait_secs: settings.sesh_wait.as_secs(),
            emu_path: settings.emu_path.as_ref().map(|p| p.display().to_string()),
            loader_path: settings.loader_path.as_ref().map(|p| p.display().to_string()),
            sesh_path: settings.sesh_path.as_ref().map(|p| p.display().to_string()),
            is_always_on_top: settings.is_always_on_top,
            insert_sim_enabled: settings.insert_sim_enabled,
            insert_sim_keybind: settings.insert_sim_keybind.clone(),
            manual_actions_enabled: settings.manual_actions_enabled.iter().map(|a| (*a).into()).collect(),
            account_swap_pool: settings.account_swap_pool.clone(),
            henrik_api_keys: settings.henrik_api_keys.clone(),
        }
    }
}

impl From<SettingsDto> for Settings {
    fn from(dto: SettingsDto) -> Self {
        Self {
            temp_val_wait: Duration::from_secs(dto.temp_val_wait_secs),
            sesh_wait: Duration::from_secs(dto.sesh_wait_secs),
            emu_path: dto.emu_path.map(PathBuf::from),
            loader_path: dto.loader_path.map(PathBuf::from),
            sesh_path: dto.sesh_path.map(PathBuf::from),
            is_always_on_top: dto.is_always_on_top,
            insert_sim_enabled: dto.insert_sim_enabled,
            insert_sim_keybind: dto.insert_sim_keybind,
            manual_actions_enabled: dto.manual_actions_enabled.into_iter().map(Into::into).collect(),
            account_swap_pool: dto.account_swap_pool,
            henrik_api_keys: dto.henrik_api_keys,
            ..Settings::default()
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountDto {
    pub id: String,
    pub label: String,
    pub username: String,
    pub has_session: bool,
}

impl From<Account> for AccountDto {
    fn from(account: Account) -> Self {
        Self { id: account.id, label: account.label, username: account.username, has_session: false }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountLookupDto {
    pub name: String,
    pub tag: String,
    pub region: String,
    pub account_level: u32,
    pub card_url: String,
    pub last_update: String,
    pub rank: Option<String>,
    pub rank_icon_url: Option<String>,
    pub rr: Option<i64>,
    pub elo: Option<i64>,
    pub peak_rank: Option<String>,
    pub games_played: i64,
    pub win_rate: i64,
    pub kda: f64,
    pub avg_hs_percent: i64,
    pub total_kills: i64,
    pub total_deaths: i64,
    pub total_assists: i64,
    pub top_agents: Vec<AgentSummaryDto>,
    pub recent_matches: Vec<MatchSummaryDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSummaryDto {
    pub agent: String,
    pub agent_icon_url: String,
    pub games: i64,
    pub wins: i64,
    pub kills: i64,
    pub deaths: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchSummaryDto {
    pub map: String,
    pub mode: String,
    pub date: i64,
    pub result: String,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
    pub hs_percent: i64,
    pub team_score: i64,
    pub enemy_score: i64,
    pub agent: String,
    pub agent_icon_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchInfoDto {
    pub in_game: bool,
    pub players: Vec<MatchPlayerDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchPlayerDto {
    pub name: String,
    pub tag: String,
    pub rank: Option<String>,
    pub rr: Option<i64>,
    pub team_side: Option<String>,
    pub ally: bool,
    pub agent: Option<String>,
    pub agent_icon_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppCreditDto {
    pub username: String,
    pub display_name: String,
    pub avatar_data_url: String,
    pub decoration_data_url: Option<String>,
    pub status: String,
    pub activity_text: Option<String>,
}
