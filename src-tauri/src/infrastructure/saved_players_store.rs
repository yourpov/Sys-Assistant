use std::path::PathBuf;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::dto::SavedPlayerDto;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredSavedPlayer {
    id             : String,
    name           : String,
    tag            : String,
    rank           : Option<String>,
    rr             : Option<i64>,
    #[serde(default)]
    rank_icon_url  : Option<String>,
    agent          : Option<String>,
    agent_icon_url : Option<String>,
    saved_at       : String,
}

pub struct SavedPlayersStore {
    path: PathBuf,
}

impl SavedPlayersStore {
    pub fn new(config_dir: PathBuf) -> Self {
        Self { path: config_dir.join("saved_players.json") }
    }

    fn load(&self) -> Vec<StoredSavedPlayer> {
        let Ok(raw) = std::fs::read_to_string(&self.path) else { return Vec::new() };
        serde_json::from_str(&raw).unwrap_or_default()
    }

    fn save(&self, players: &[StoredSavedPlayer]) -> Result<(), AppError> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Account(format!("couldn't save players ({e})")))?;
        }
        let json = serde_json::to_string_pretty(players).map_err(|e| AppError::Account(format!("couldn't save players ({e})")))?;
        std::fs::write(&self.path, json).map_err(|e| AppError::Account(format!("couldn't save players ({e})")))
    }

    pub fn list(&self) -> Vec<SavedPlayerDto> {
        let mut players: Vec<SavedPlayerDto> = self.load().iter().map(to_dto).collect();
        players.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
        players
    }

    pub fn upsert(
        &self,
        name: String,
        tag: String,
        rank: Option<String>,
        rr: Option<i64>,
        rank_icon_url: Option<String>,
        agent: Option<String>,
        agent_icon_url: Option<String>,
    ) -> Result<SavedPlayerDto, AppError> {
        let mut players = self.load();
        let key = player_key(&name, &tag);
        if let Some(index) = players.iter().position(|p| player_key(&p.name, &p.tag) == key) {
            let existing = &mut players[index];
            existing.rank = rank;
            existing.rr = rr;
            if rank_icon_url.is_some() {
                existing.rank_icon_url = rank_icon_url;
            }
            if agent.is_some() {
                existing.agent = agent;
            }
            if agent_icon_url.is_some() {
                existing.agent_icon_url = agent_icon_url;
            }
            let dto = to_dto(existing);
            self.save(&players)?;
            return Ok(dto);
        }

        let stored = StoredSavedPlayer {
            id: Uuid::new_v4().to_string(),
            name,
            tag,
            rank,
            rr,
            rank_icon_url,
            agent,
            agent_icon_url,
            saved_at: Utc::now().to_rfc3339(),
        };
        let dto = to_dto(&stored);
        players.push(stored);
        self.save(&players)?;
        Ok(dto)
    }

    pub fn remove(&self, id: &str) -> Result<(), AppError> {
        let mut players = self.load();
        let before = players.len();
        players.retain(|p| p.id != id);
        if players.len() == before {
            return Err(AppError::Account("saved player not found".into()));
        }
        self.save(&players)
    }
}

fn to_dto(player: &StoredSavedPlayer) -> SavedPlayerDto {
    SavedPlayerDto {
        id             : player.id.clone(),
        name           : player.name.clone(),
        tag            : player.tag.clone(),
        rank           : player.rank.clone(),
        rr             : player.rr,
        rank_icon_url  : player.rank_icon_url.clone(),
        agent          : player.agent.clone(),
        agent_icon_url : player.agent_icon_url.clone(),
        saved_at       : player.saved_at.clone(),
    }
}

fn player_key(name: &str, tag: &str) -> String {
    format!("{}#{}", name.to_lowercase(), tag.to_lowercase())
}