use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::process::Command;

use crate::application::ports::ProcessLauncher;
use crate::error::AppError;

const SW_SHOWNORMAL: i32 = 1;
const SW_HIDE: i32 = 0;
const SEE_MASK_NOCLOSEPROCESS: u32 = 0x0000_0040;
const SEE_MASK_NOASYNC: u32 = 0x0000_0100;
const ELEVATED_WAIT_MS: u32 = 120_000;

#[repr(C)]
struct ShellExecuteInfoW {
    cb_size          : u32,
    f_mask           : u32,
    hwnd             : *mut core::ffi::c_void,
    lp_verb          : *const u16,
    lp_file          : *const u16,
    lp_parameters    : *const u16,
    lp_directory     : *const u16,
    n_show           : i32,
    h_inst_app       : isize,
    lp_id_list       : *mut core::ffi::c_void,
    lp_class         : *const u16,
    hkey_class       : *mut core::ffi::c_void,
    dw_hot_key       : u32,
    h_icon_or_monitor: *mut core::ffi::c_void,
    h_process        : *mut core::ffi::c_void,
}

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

    fn ShellExecuteExW(info: *mut ShellExecuteInfoW) -> i32;
}

#[link(name = "kernel32")]
extern "system" {
    fn WaitForSingleObject(handle: *mut core::ffi::c_void, milliseconds: u32) -> u32;
    fn CloseHandle(handle: *mut core::ffi::c_void) -> i32;
}

fn to_wide(s: &str) -> Vec<u16> {
    std::ffi::OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

pub async fn run_elevated_command(program: &str, parameters: &str) -> Result<(), AppError> {
    let operation = to_wide("runas");
    let file      = to_wide(program);
    let params    = to_wide(parameters);
    let label     = program.to_string();

    tokio::task::spawn_blocking(move || {
        let mut info: ShellExecuteInfoW = unsafe { std::mem::zeroed() };
        info.cb_size       = std::mem::size_of::<ShellExecuteInfoW>() as u32;
        info.f_mask        = SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC;
        info.lp_verb       = operation.as_ptr();
        info.lp_file       = file.as_ptr();
        info.lp_parameters = params.as_ptr();
        info.n_show        = SW_HIDE;

        let started = unsafe { ShellExecuteExW(&mut info) };
        if started == 0 {
            return Err(AppError::Launch(label, "ShellExecuteEx failed (admin prompt declined or blocked)".into()));
        }

        if !info.h_process.is_null() {
            unsafe {
                WaitForSingleObject(info.h_process, ELEVATED_WAIT_MS);
                CloseHandle(info.h_process);
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| AppError::Launch("elevated command".into(), e.to_string()))?
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
