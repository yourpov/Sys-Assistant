use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use uiautomation::controls::ControlType;
use uiautomation::patterns::{UITogglePattern, UIValuePattern};
use uiautomation::types::ToggleState;
use uiautomation::{UIAutomation, UIElement};

use crate::application::ports::{EventSink, LogLevel, RiotLogin};
use crate::error::AppError;

const WINDOW_TIMEOUT_MS: u64              = 5000;
const FIELD_TIMEOUT_MS: u64               = 3000;
const KEY_INTERVAL_MS: u64                = 10;
const POST_SUBMIT_POLL_INTERVAL: Duration = Duration::from_millis(500);
const POST_SUBMIT_TIMEOUT: Duration       = Duration::from_secs(35);
const ERROR_TEXT_TIMEOUT_MS: u64          = 800;
const FIELD_CHECK_TIMEOUT_MS: u64         = 800;
const REQUIRED_CLEAN_POLLS: u32           = 6;
const ERROR_KEYWORDS: [&str; 8]           = ["trouble", "unable", "incorrect", "failed", "try again", "error", "invalid", "wrong"];
const LOGIN_FORM_TIMEOUT: Duration        = Duration::from_secs(20);
const LOGIN_FORM_POLL_INTERVAL: Duration  = Duration::from_millis(600);
const STAY_SIGNED_IN_ATTEMPTS: u32        = 5;
const STAY_SIGNED_IN_RETRY: Duration      = Duration::from_millis(400);

pub struct WindowsRiotLogin;

impl RiotLogin for WindowsRiotLogin {
    fn login(
        &self,
        pid: u32,
        username: &str,
        password: &str,
        sink: &dyn EventSink,
        stop: &AtomicBool,
    ) -> Result<(), AppError> {
        if stop.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }

        let automation = UIAutomation::new().map_err(|e| AppError::RiotClient(format!("couldn't start ui automation ({e})").into()))?;
        let root = automation.get_root_element().map_err(|e| AppError::RiotClient(format!("couldn't access the desktop ({e})").into()))?;

        let window = wait_for_login_form(&automation, &root, pid, stop)?;

        let fields = automation
            .create_matcher()
            .from(window.clone())
            .control_type(ControlType::Edit)
            .timeout(FIELD_TIMEOUT_MS)
            .find_all()
            .map_err(|e| AppError::RiotClient(format!("couldn't find the riot client's login fields ({e})").into()))?;

        let username_field = fields
            .iter()
            .find(|el| el.get_automation_id().map(|id| id == "username").unwrap_or(false))
            .ok_or_else(|| AppError::RiotClient("couldn't find the username field on the riot client's login screen".into()))?;
        let password_field = fields
            .iter()
            .find(|el| el.get_automation_id().map(|id| id == "password").unwrap_or(false))
            .ok_or_else(|| AppError::RiotClient("couldn't find the password field on the riot client's login screen".into()))?;

        let username_value: UIValuePattern =
            username_field.get_pattern().map_err(|e| AppError::RiotClient(format!("couldn't fill in the username field ({e})").into()))?;
        username_value.set_value(username).map_err(|e| AppError::RiotClient(format!("couldn't fill in the username field ({e})").into()))?;
        nudge_field(username_field);

        let password_value: UIValuePattern =
            password_field.get_pattern().map_err(|e| AppError::RiotClient(format!("couldn't fill in the password field ({e})").into()))?;
        password_value.set_value(password).map_err(|e| AppError::RiotClient(format!("couldn't fill in the password field ({e})").into()))?;
        nudge_field(password_field);

        check_stay_signed_in_box(&automation, &window, sink);

        if stop.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }

        password_field
            .send_keys("{enter}", KEY_INTERVAL_MS)
            .map_err(|e| AppError::RiotClient(format!("couldn't submit the riot client's login form ({e})").into()))?;

        wait_for_login_outcome(&automation, &window, stop)
    }
}

fn wait_for_login_form(automation: &UIAutomation, root: &UIElement, pid: u32, stop: &AtomicBool) -> Result<UIElement, AppError> {
    let deadline         = std::time::Instant::now() + LOGIN_FORM_TIMEOUT;
    let mut found_window = false;
    let mut last_window: Option<UIElement> = None;

    loop {
        if stop.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }

        if let Ok(window) = find_riot_window(automation, root, pid) {
            found_window = true;
            if still_on_login_form(automation, &window) {
                return Ok(window);
            }
            last_window = Some(window);
        }

        if std::time::Instant::now() >= deadline {
            break;
        }
        std::thread::sleep(LOGIN_FORM_POLL_INTERVAL);
    }

    if !found_window {
        let seen = describe_top_level_elements(automation, root);
        return Err(AppError::RiotClient(format!(
            "couldn't find the riot client's login window (pid {pid}). make sure it's open to the sign-in screen, then try again. visible top-level elements: {seen}"
        ).into()));
    }

    let seen = last_window
        .as_ref()
        .map(|window| describe_elements(automation, window, 8, 4000))
        .unwrap_or_else(|| "(none)".to_string());
    Err(AppError::RiotClient(format!(
        "you're still signed in to another account, and \"stay signed in\" means the riot client won't show a login screen on its own. \
         click your profile icon in the riot client, then Sign Out, then try this again. visible elements: {seen}"
    ).into()))
}

fn nudge_field(field: &UIElement) {
    let _ = field.send_keys("{END} {BACKSPACE}", KEY_INTERVAL_MS);
}

fn check_stay_signed_in_box(automation: &UIAutomation, window: &UIElement, sink: &dyn EventSink) {
    for attempt in 0..STAY_SIGNED_IN_ATTEMPTS {
        if try_check_stay_signed_in(automation, window) {
            return;
        }
        if attempt + 1 < STAY_SIGNED_IN_ATTEMPTS {
            std::thread::sleep(STAY_SIGNED_IN_RETRY);
        }
    }
    sink.emit_line(
        LogLevel::Warn,
        "couldn't tick \"stay signed in\" on the riot client's login screen. you may need to enable it manually",
    );
}

fn try_check_stay_signed_in(automation: &UIAutomation, window: &UIElement) -> bool {
    let Ok(checkboxes) = automation.create_matcher().from(window.clone()).control_type(ControlType::CheckBox).timeout(FIELD_CHECK_TIMEOUT_MS).find_all() else {
        return false;
    };
    let Some(checkbox) = checkboxes.into_iter().find(|el| el.get_name().map(|name| name.to_lowercase().contains("stay signed in")).unwrap_or(false)) else {
        return false;
    };
    let Ok(toggle): Result<UITogglePattern, _> = checkbox.get_pattern() else {
        return false;
    };
    if matches!(toggle.get_toggle_state(), Ok(ToggleState::On)) {
        return true;
    }
    let _ = toggle.toggle();
    matches!(toggle.get_toggle_state(), Ok(ToggleState::On))
}

fn wait_for_login_outcome(automation: &UIAutomation, window: &UIElement, stop: &AtomicBool) -> Result<(), AppError> {
    let deadline = std::time::Instant::now() + POST_SUBMIT_TIMEOUT;
    let mut clean_polls = 0u32;
    loop {
        if stop.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }
        if let Some(message) = find_login_error(automation, window) {
            return Err(login_failed_error(&message));
        }

        if still_on_login_form(automation, window) {
            clean_polls = 0;
        } else {
            clean_polls += 1;
            if clean_polls >= REQUIRED_CLEAN_POLLS {
                return Ok(());
            }
        }

        if std::time::Instant::now() >= deadline {
            return Err(AppError::RiotClient(
                "the riot client didn't finish signing in within 35 seconds. it may still be loading. check the riot client, then try again".into(),
            ));
        }

        std::thread::sleep(POST_SUBMIT_POLL_INTERVAL);
    }
}

fn login_failed_error(message: &str) -> AppError {
    AppError::RiotClient(format!("the riot client couldn't sign in. it said: \"{message}\". double-check the saved password, then try again").into())
}

fn still_on_login_form(automation: &UIAutomation, window: &UIElement) -> bool {
    automation
        .create_matcher()
        .from(window.clone())
        .control_type(ControlType::Edit)
        .timeout(FIELD_CHECK_TIMEOUT_MS)
        .find_all()
        .map(|fields| fields.iter().any(|el| el.get_automation_id().map(|id| id == "username" || id == "password").unwrap_or(false)))
        .unwrap_or(false)
}

fn find_riot_window(automation: &UIAutomation, root: &UIElement, pid: u32) -> uiautomation::Result<UIElement> {
    automation.create_matcher().from(root.clone()).control_type(ControlType::Window).process_id(pid).timeout(WINDOW_TIMEOUT_MS).find_first().or_else(|e| {
        automation.create_matcher().from(root.clone()).control_type(ControlType::Pane).process_id(pid).timeout(WINDOW_TIMEOUT_MS).find_first().map_err(|_| e)
    })
}

fn describe_top_level_elements(automation: &UIAutomation, root: &UIElement) -> String {
    describe_elements(automation, root, 2, 2000)
}

fn describe_elements(automation: &UIAutomation, root: &UIElement, depth: u32, timeout_ms: u64) -> String {
    let elements = match automation.create_matcher().from(root.clone()).depth(depth).timeout(timeout_ms).find_all() {
        Ok(elements) => elements,
        Err(e) => return format!("(couldn't enumerate: {e})"),
    };

    let descriptions: Vec<String> = elements
        .iter()
        .filter_map(|el| {
            let name = el.get_name().unwrap_or_default();
            let automation_id = el.get_automation_id().unwrap_or_default();
            let classname = el.get_classname().unwrap_or_default();
            if name.is_empty() && automation_id.is_empty() && classname.is_empty() {
                return None;
            }
            let control_type = el.get_control_type().map(|c| format!("{c:?}")).unwrap_or_else(|_| "?".into());
            Some(format!("[{control_type}] name=\"{name}\" id=\"{automation_id}\" class=\"{classname}\""))
        })
        .collect();

    if descriptions.is_empty() {
        "(none)".to_string()
    } else {
        descriptions.join("; ")
    }
}

fn find_login_error(automation: &UIAutomation, window: &UIElement) -> Option<String> {
    let texts = automation.create_matcher().from(window.clone()).control_type(ControlType::Text).timeout(ERROR_TEXT_TIMEOUT_MS).find_all().ok()?;

    texts.into_iter().find_map(|el| {
        let name = el.get_name().ok()?;
        let lower = name.to_lowercase();
        ERROR_KEYWORDS.iter().any(|keyword| lower.contains(keyword)).then_some(name)
    })
}
