use std::path::PathBuf;

use crate::error::AppError;
use crate::infrastructure::discord_auth::AuthSession;

pub struct AuthStore {
    path: PathBuf,
}

impl AuthStore {
    pub fn new(config_dir: PathBuf) -> Self {
        Self { path: config_dir.join("auth_session.json") }
    }

    pub fn load(&self) -> Option<AuthSession> {
        let raw = std::fs::read_to_string(&self.path).ok()?;
        serde_json::from_str(&raw).ok()
    }

    pub fn save(&self, session: &AuthSession) -> Result<(), AppError> {
        let parent = self.path.parent().ok_or_else(|| AppError::Settings("auth session path has no parent folder".into()))?;
        std::fs::create_dir_all(parent).map_err(|e| AppError::Settings(format!("couldn't create auth folder ({e})")))?;
        let json = serde_json::to_string_pretty(session).map_err(|e| AppError::Settings(format!("couldn't encode auth session ({e})")))?;
        std::fs::write(&self.path, json).map_err(|e| AppError::Settings(format!("couldn't save auth session ({e})")))?;
        Ok(())
    }

    pub fn clear(&self) -> Result<(), AppError> {
        match std::fs::remove_file(&self.path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(AppError::Settings(format!("couldn't clear auth session ({e})"))),
        }
    }
}