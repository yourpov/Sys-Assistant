use std::path::Path;
use std::process::Command;

use crate::application::ports::ProcessLauncher;
use crate::error::AppError;

pub struct WindowsLauncher;

#[async_trait::async_trait]
impl ProcessLauncher for WindowsLauncher {
    async fn launch(&self, path: &Path, args: &[&str]) -> Result<(), AppError> {
        let mut command = Command::new(path);
        command.args(args);
        if let Some(dir) = path.parent() {
            command.current_dir(dir);
        }
        command.spawn().map(|_| ()).map_err(|e| AppError::Launch(path.display().to_string(), e.to_string()))
    }
}
