use std::sync::Arc;

use tauri::{AppHandle, Emitter};

use crate::application::ports::{EventSink, LogLevel};
use crate::dto::LogLineDto;
use crate::infrastructure::app_log::AppLogStore;

pub struct TauriEventSink {
    pub app     : AppHandle,
    pub app_log : Arc<AppLogStore>,
}

impl EventSink for TauriEventSink {
    fn emit_line(&self, level: LogLevel, message: &str) {
        let label = level_label(level);
        self.app_log.append(label, message);
        let dto = LogLineDto { level: label, message: message.to_string(), replace: false };
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
