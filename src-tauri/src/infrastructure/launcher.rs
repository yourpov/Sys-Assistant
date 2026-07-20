use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::process::Command;

use crate::application::ports::ProcessLauncher;
use crate::error::AppError;

const SW_SHOWNORMAL: i32 = 1;

#[link(name = "shell32")]
extern "system" {
    fn ShellExecuteW(
        hwnd: *mut core::ffi::c_void,
        lp_operation: *const u16,
        lp_file: *const u16,
        lp_parameters: *const u16,
        lp_directory: *const u16,
        n_show_cmd: i32,
    ) -> isize;
}

fn to_wide(s: &str) -> Vec<u16> {
    std::ffi::OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

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

    async fn launch_elevated(&self, path: &Path) -> Result<(), AppError> {
        let path      = path.to_path_buf();
        let operation = to_wide("runas");
        let file      = to_wide(&path.display().to_string());
        let directory = path.parent().map(|dir| to_wide(&dir.display().to_string()));

        tokio::task::spawn_blocking(move || {
            let result = unsafe {
                ShellExecuteW(
                    std::ptr::null_mut(),
                    operation.as_ptr(),
                    file.as_ptr(),
                    std::ptr::null(),
                    directory.as_ref().map_or(std::ptr::null(), |dir| dir.as_ptr()),
                    SW_SHOWNORMAL,
                )
            };
            if result > 32 {
                Ok(())
            } else {
                Err(AppError::Launch(path.display().to_string(), format!("ShellExecute failed (code {result})")))
            }
        })
        .await
        .map_err(|e| AppError::Launch("elevated launch".into(), e.to_string()))?
    }
}
