use tauri::{AppHandle, Emitter};

use crate::application::ports::{EventSink, LogLevel};
use crate::dto::LogLineDto;

pub struct TauriEventSink {
    pub app: AppHandle,
}

impl EventSink for TauriEventSink {
    fn emit_line(&self, level: LogLevel, message: &str) {
        let dto = LogLineDto { level: level_label(level), message: message.to_string() };
        let _ = self.app.emit("workflow://log", dto);
    }
}

fn level_label(level: LogLevel) -> &'static str {
    match level {
        LogLevel::Ok => "ok",
        LogLevel::Warn => "warn",
        LogLevel::Error => "error",
        LogLevel::Info => "info",
    }
}
