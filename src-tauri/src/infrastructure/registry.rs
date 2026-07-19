use std::os::windows::process::CommandExt;
use std::process::Command;

use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_SET_VALUE};
use winreg::RegKey;

use crate::application::ports::{EmuEnvironment, SystemHealth};
use crate::error::AppError;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const TERMINAL_SERVER_KEY: &str    = "SYSTEM\\CurrentControlSet\\Control\\Terminal Server";
const VC_RUNTIME_KEY: &str         = "SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64";
const ENVIRONMENT_KEY: &str        = "SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment";
const CORE_ISOLATION_KEY: &str     = "SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity";
const DRIVER_BLOCKLIST_KEY: &str   = "SYSTEM\\CurrentControlSet\\Control\\CI\\Config";
const LSA_KEY: &str                = "SYSTEM\\CurrentControlSet\\Control\\Lsa";

pub struct WindowsMachineConfig;

#[async_trait::async_trait]
impl SystemHealth for WindowsMachineConfig {
    fn is_rdp_disabled(&self) -> Result<bool, AppError> {
        let key = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(TERMINAL_SERVER_KEY)
            .map_err(|e| AppError::Registry(e.to_string()))?;
        let deny_connections: u32 = key.get_value("fDenyTSConnections").map_err(|e| AppError::Registry(e.to_string()))?;
        Ok(deny_connections != 0)
    }

    async fn disable_rdp(&self) -> Result<(), AppError> {
        let key = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey_with_flags(TERMINAL_SERVER_KEY, KEY_SET_VALUE)
            .map_err(|e| AppError::Registry(e.to_string()))?;
        key.set_value("fDenyTSConnections", &1u32).map_err(|e| AppError::Registry(e.to_string()))
    }

    fn is_vc_redist_installed(&self) -> Result<bool, AppError> {
        let installed = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(VC_RUNTIME_KEY)
            .and_then(|key| key.get_value::<u32, _>("Installed"))
            .unwrap_or(0);
        Ok(installed != 0)
    }

    fn is_core_isolation_enabled(&self) -> Result<bool, AppError> {
        let enabled = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(CORE_ISOLATION_KEY)
            .and_then(|key| key.get_value::<u32, _>("Enabled"))
            .unwrap_or(0);
        Ok(enabled != 0)
    }

    fn is_vulnerable_driver_blocklist_enabled(&self) -> Result<bool, AppError> {
        let enabled = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(DRIVER_BLOCKLIST_KEY)
            .and_then(|key| key.get_value::<u32, _>("VulnerableDriverBlocklistEnable"))
            .unwrap_or(0);
        Ok(enabled != 0)
    }

    fn is_lsa_protection_enabled(&self) -> Result<bool, AppError> {
        let run_as_ppl = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(LSA_KEY)
            .and_then(|key| key.get_value::<u32, _>("RunAsPPL"))
            .unwrap_or(0);
        Ok(run_as_ppl != 0)
    }
}

#[async_trait::async_trait]
impl EmuEnvironment for WindowsMachineConfig {
    fn current_emu_seed(&self) -> Option<String> {
        RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(ENVIRONMENT_KEY).ok()?.get_value::<String, _>("EMU_SEED").ok()
    }

    async fn set_emu_seed(&self, seed: u32) -> Result<(), AppError> {
        let key = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey_with_flags(ENVIRONMENT_KEY, KEY_SET_VALUE)
            .map_err(|e| AppError::Registry(e.to_string()))?;
        key.set_value("EMU_SEED", &seed.to_string()).map_err(|e| AppError::Registry(e.to_string()))
    }

    async fn flush_dns(&self) -> Result<(), AppError> {
        tokio::task::spawn_blocking(|| {
            Command::new("ipconfig").creation_flags(CREATE_NO_WINDOW).arg("/flushdns").output().map(|_| ())
        })
        .await
        .map_err(|e| AppError::Service(e.to_string()))?
        .map_err(|e| AppError::Service(e.to_string()))
    }
}
