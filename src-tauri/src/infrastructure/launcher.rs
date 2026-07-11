use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::process::{Command, Stdio};

use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt, BufReader};

use crate::application::ports::{EventSink, LogLevel, ProcessLauncher};
use crate::error::AppError;

const CREATE_NO_WINDOW: u32      = 0x0800_0000;
const PRIMED_ENTER_PRESSES: &str = "\r\n\r\n\r\n";
const SW_SHOWNORMAL: i32          = 1;

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

    async fn launch_silent_and_confirm(&self, path: &Path, sink: &dyn EventSink) -> Result<(), AppError> {
        let mut command = tokio::process::Command::new(path);
        command.creation_flags(CREATE_NO_WINDOW);
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());
        if let Some(dir) = path.parent() {
            command.current_dir(dir);
        }

        let mut child = command.spawn().map_err(|e| AppError::Launch(path.display().to_string(), e.to_string()))?;

        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(PRIMED_ENTER_PRESSES.as_bytes()).await;
            drop(stdin);
        }

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let (_, _, status) = tokio::join!(forward_lines(stdout, sink), forward_lines(stderr, sink), child.wait());
        status.map_err(|e| AppError::Launch(path.display().to_string(), e.to_string()))?;
        Ok(())
    }
}

async fn forward_lines(pipe: Option<impl AsyncRead + Unpin>, sink: &dyn EventSink) {
    let Some(pipe) = pipe else { return };
    let mut reader = BufReader::new(pipe);
    let mut buf = Vec::new();
    loop {
        buf.clear();
        match read_until_line_boundary(&mut reader, &mut buf).await {
            Ok(0) => break,
            Ok(_) => {
                let trimmed = String::from_utf8_lossy(&buf).trim().to_string();
                if trimmed.is_empty() {
                    continue;
                }
                if is_progress_line(&trimmed) {
                    sink.emit_progress(&trimmed);
                } else {
                    sink.emit_line(LogLevel::Info, &trimmed);
                }
            }
            Err(_) => break,
        }
    }
}

const BACKSPACE: u8 = 0x08;

async fn read_until_line_boundary(reader: &mut (impl AsyncRead + Unpin), buf: &mut Vec<u8>) -> std::io::Result<usize> {
    let mut byte = [0u8; 1];
    let mut read_count = 0;
    loop {
        let n = reader.read(&mut byte).await?;
        if n == 0 {
            return Ok(read_count);
        }
        read_count += 1;
        match byte[0] {
            b'\n' | b'\r' => return Ok(read_count),
            BACKSPACE => {
                buf.pop();
            }
            b => buf.push(b),
        }
    }
}

fn is_progress_line(line: &str) -> bool {
    let bytes = line.as_bytes();
    bytes.iter().enumerate().any(|(i, &b)| b == b'%' && i > 0 && bytes[i - 1].is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_a_bare_percent_line() {
        assert!(is_progress_line("99%"));
        assert!(is_progress_line("installing... 47%"));
        assert!(is_progress_line("100%"));
    }

    #[test]
    fn does_not_flag_ordinary_lines() {
        assert!(!is_progress_line("seed set to 3613156392"));
        assert!(!is_progress_line("ready"));
    }
}
