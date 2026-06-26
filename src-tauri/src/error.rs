#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0} not found in the app folder or its subfolders. add it there, or set its path in Settings")]
    FileMissing(String),
    #[error("couldn't start {0} ({1})")]
    Launch(String, String),
    #[error("{0}")]
    RiotClient(String),
    #[error("{0}")]
    Network(String),
    #[error("couldn't read or update the registry ({0})")]
    Registry(String),
    #[error("couldn't save settings ({0})")]
    Settings(String),
    #[error("{0}")]
    Account(String),
    #[error("{0}")]
    Service(String),
    #[error("{0}")]
    Input(String),
    #[error("cancelled")]
    Cancelled,
}
