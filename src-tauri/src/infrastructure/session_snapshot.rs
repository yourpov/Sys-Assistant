use std::path::{Path, PathBuf};

use crate::application::ports::{EventSink, LogLevel, SessionSnapshotStore};
use crate::error::AppError;

enum Base {
    LocalAppData,
    InstallDir,
}

struct SessionFile {
    base     : Base,
    rel_path : &'static str,
    is_dir   : bool,
    critical : bool,
}

const SESSION_FILES: &[SessionFile] = &[
    SessionFile { base: Base::LocalAppData, rel_path: "Riot Games/Riot Client/Data/RiotGamesPrivateSettings.yaml", is_dir: false, critical: false },
    SessionFile { base: Base::LocalAppData, rel_path: "Riot Games/Riot Client/Data/Sessions", is_dir: true, critical: true },
    SessionFile { base: Base::LocalAppData, rel_path: "Riot Games/Riot Client/Config/RiotClientSettings.yaml", is_dir: false, critical: false },
    SessionFile { base: Base::LocalAppData, rel_path: "Riot Games/Riot Client/Config/lockfile", is_dir: false, critical: false },
    SessionFile { base: Base::InstallDir, rel_path: "Config/client.config.yaml", is_dir: false, critical: false },
    SessionFile { base: Base::InstallDir, rel_path: "Config/client.settings.yaml", is_dir: false, critical: false },
];

const ACTIVE_SESSION_FILES: &[&str] =
    &["Riot Games/Riot Client/Data/Sessions", "Riot Games/Riot Client/Config/lockfile", "Riot Games/Riot Client/Data/RiotGamesPrivateSettings.yaml"];

pub struct WindowsSessionSnapshotStore {
    snapshots_dir: PathBuf,
}

impl WindowsSessionSnapshotStore {
    pub fn new(config_dir: PathBuf) -> Self {
        Self { snapshots_dir: config_dir.join("sessions") }
    }

    fn account_dir(&self, account_id: &str) -> PathBuf {
        self.snapshots_dir.join(account_id)
    }

    fn live_path(file: &SessionFile, install_dir: Option<&Path>) -> Option<PathBuf> {
        match file.base {
            Base::LocalAppData => std::env::var_os("LOCALAPPDATA").map(|dir| Path::new(&dir).join(file.rel_path)),
            Base::InstallDir => install_dir.map(|dir| dir.join(file.rel_path)),
        }
    }

    fn copy_path(source: &Path, destination: &Path, is_dir: bool) -> std::io::Result<()> {
        if !source.exists() {
            return Ok(());
        }
        if let Some(parent) = destination.parent() {
            std::fs::create_dir_all(parent)?;
        }
        if is_dir {
            copy_dir_recursive(source, destination)
        } else {
            std::fs::copy(source, destination).map(|_| ())
        }
    }
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(destination)?;
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        let dest_path = destination.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&entry.path(), &dest_path)?;
        } else {
            std::fs::copy(entry.path(), dest_path)?;
        }
    }
    Ok(())
}

impl SessionSnapshotStore for WindowsSessionSnapshotStore {
    fn has_snapshot(&self, account_id: &str) -> bool {
        let account_dir = self.account_dir(account_id);
        if !account_dir.exists() {
            return false;
        }
        SESSION_FILES.iter().filter(|file| file.critical).all(|file| account_dir.join(file.rel_path).exists())
    }

    fn save(&self, account_id: &str, install_dir: Option<&Path>, sink: &dyn EventSink) -> Result<(), AppError> {
        let account_dir = self.account_dir(account_id);
        let mut incomplete = false;
        for file in SESSION_FILES {
            let Some(source) = Self::live_path(file, install_dir) else {
                incomplete = true;
                continue;
            };
            let destination = account_dir.join(file.rel_path);

            if destination.exists() {
                let clear = if destination.is_dir() {
                    std::fs::remove_dir_all(&destination)
                } else {
                    std::fs::remove_file(&destination)
                };
                clear.map_err(|e| AppError::RiotClient(format!("couldn't clear the previous saved session for this account ({e})").into()))?;
            }

            if !source.exists() {
                incomplete = true;
                continue;
            }

            Self::copy_path(&source, &destination, file.is_dir)
                .map_err(|e| AppError::RiotClient(format!("couldn't save the session for this account ({e})").into()))?;
        }
        if incomplete {
            sink.emit_line(
                LogLevel::Warn,
                "couldn't save every part of this session, if signing in with it later doesn't work, sign in fresh again",
            );
        }
        Ok(())
    }

    fn restore(&self, account_id: &str, install_dir: Option<&Path>, sink: &dyn EventSink) -> Result<(), AppError> {
        let account_dir = self.account_dir(account_id);
        let mut incomplete = false;
        for file in SESSION_FILES {
            let Some(destination) = Self::live_path(file, install_dir) else { continue };
            let source = account_dir.join(file.rel_path);

            if destination.exists() {
                let clear = if destination.is_dir() {
                    std::fs::remove_dir_all(&destination)
                } else {
                    std::fs::remove_file(&destination)
                };
                clear.map_err(|e| AppError::RiotClient(format!("couldn't clear the current riot session ({e})").into()))?;
            }

            if !source.exists() {
                incomplete = true;
                continue;
            }

            Self::copy_path(&source, &destination, file.is_dir)
                .map_err(|e| AppError::RiotClient(format!("couldn't restore the saved session for this account ({e})").into()))?;
        }
        if incomplete {
            sink.emit_line(LogLevel::Warn, "this saved session was missing a few extra details, sign in fresh again if anything looks off");
        }
        Ok(())
    }

    fn clear_active_session(&self) -> Result<(), AppError> {
        let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") else {
            return Err(AppError::RiotClient("couldn't find your windows user folder (LOCALAPPDATA isn't set)".into()));
        };
        for rel_path in ACTIVE_SESSION_FILES {
            let path = Path::new(&local_app_data).join(rel_path);
            if !path.exists() {
                continue;
            }
            let result = if path.is_dir() { std::fs::remove_dir_all(&path) } else { std::fs::remove_file(&path) };
            result.map_err(|e| AppError::RiotClient(format!("couldn't clear the current riot session ({e})").into()))?;
        }
        Ok(())
    }

    fn forget(&self, account_id: &str) -> Result<(), AppError> {
        let account_dir = self.account_dir(account_id);
        if !account_dir.exists() {
            return Ok(());
        }
        std::fs::remove_dir_all(&account_dir)
            .map_err(|e| AppError::RiotClient(format!("couldn't forget the saved session for this account ({e})").into()))
    }
}
