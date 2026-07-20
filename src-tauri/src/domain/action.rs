#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkflowAction {
    Start,
    CloseAll,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ManualAction {
    ToggleValorant,
    ToggleRiotClient,
    OpenLoader,
    ChangeSeed,
    OpenEmuInstaller,
    OpenTraceX,
    RestartValorant,
}
