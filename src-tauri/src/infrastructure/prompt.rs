use std::path::PathBuf;

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::application::ports::UserPrompt;

pub struct DialogPrompt {
    pub app: AppHandle,
}

#[async_trait::async_trait]
impl UserPrompt for DialogPrompt {
    async fn pick_riot_client_exe(&self) -> Option<PathBuf> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.app
            .dialog()
            .file()
            .add_filter("RiotClientServices.exe", &["exe"])
            .set_title("Select RiotClientServices.exe")
            .pick_file(move |file| {
                let _ = tx.send(file.and_then(|f| f.into_path().ok()));
            });
        rx.await.ok().flatten()
    }
}
