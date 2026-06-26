#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkflowAction {
    StartWithRestart,
    StartWithoutRestart,
    Fix55Error,
    CloseAll,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ManualAction {
    ToggleValorant,
    ToggleRiotClient,
    OpenLoader,
    ChangeSeed,
    OpenEmuInstaller,
    RestartValorant,
    CreateSession,
}
