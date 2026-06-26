use uiautomation::inputs::Keyboard;

use crate::application::ports::KeySimulator;
use crate::error::AppError;

pub struct WindowsKeySimulator;

impl KeySimulator for WindowsKeySimulator {
    fn press_insert(&self) -> Result<(), AppError> {
        Keyboard::new().send_keys("{insert}").map_err(|e| AppError::Input(format!("couldn't simulate the insert key ({e})")))
    }

    fn press_key(&self, key: &str) -> Result<(), AppError> {
        Keyboard::new().send_keys(key).map_err(|e| AppError::Input(format!("couldn't replay the \"{key}\" key ({e})")))
    }
}
