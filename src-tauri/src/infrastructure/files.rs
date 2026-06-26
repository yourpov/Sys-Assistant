use std::path::{Path, PathBuf};

use crate::application::ports::FileFinder;

pub struct AppDirFileFinder {
    app_dir: PathBuf,
}

impl AppDirFileFinder {
    pub fn new(app_dir: PathBuf) -> Self {
        Self { app_dir }
    }
}

impl FileFinder for AppDirFileFinder {
    fn find(&self, filename: &str, override_path: Option<&Path>) -> Option<PathBuf> {
        if let Some(path) = override_path {
            if path.exists() {
                return Some(path.to_path_buf());
            }
        }
        search_dir(&self.app_dir, filename)
    }
}

fn search_dir(dir: &Path, filename: &str) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    let mut subdirs = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            subdirs.push(path);
        } else if path.file_name().and_then(|n| n.to_str()) == Some(filename) {
            return Some(path);
        }
    }
    subdirs.iter().find_map(|subdir| search_dir(subdir, filename))
}
