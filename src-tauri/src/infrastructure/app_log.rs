use std::collections::VecDeque;
use std::sync::Mutex;

const MAX_LOG_LINES: usize = 2000;

pub struct AppLogStore {
    lines: Mutex<VecDeque<String>>,
}

impl Default for AppLogStore {
    fn default() -> Self {
        Self { lines: Mutex::new(VecDeque::new()) }
    }
}

impl AppLogStore {
    pub fn append(&self, level: &str, message: &str) {
        let timestamp = chrono::Local::now().format("%H:%M:%S");
        let line = format!("[{timestamp}] {level} {message}");
        let mut lines = self.lines.lock().unwrap();
        if lines.len() >= MAX_LOG_LINES {
            lines.pop_front();
        }
        lines.push_back(line);
    }

    pub fn read(&self) -> String {
        self.lines.lock().unwrap().iter().cloned().collect::<Vec<_>>().join("\n")
    }

    pub fn clear(&self) {
        self.lines.lock().unwrap().clear();
    }
}
