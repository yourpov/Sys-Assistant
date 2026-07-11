#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0} not found in the app folder or its subfolders. add it there, or set its path in Settings")]
    FileMissing(String),
    #[error("couldn't start {0} ({1})")]
    Launch(String, String),
    #[error("{0}")]
    RiotClient(RiotClientError),
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

#[derive(Debug, thiserror::Error)]
pub enum RiotClientError {
    #[error("riot client's lockfile isn't there. make sure the riot client is running, then try again")]
    LockfileMissing,
    #[error("riot client isn't running anymore. try running this again")]
    NotRunning,
    #[error("riot client's lockfile looks different than expected. try restarting the riot client")]
    LockfileMalformed,
    #[error("the riot client isn't ready yet. make sure you're signed in, then try again")]
    NotReady,
    #[error("the riot client's local api rejected the request (HTTP {0})")]
    Rejected(u16),
    #[error("couldn't reach the riot client's local api ({0})")]
    Unreachable(String),
    #[error("your owned items couldn't load ({0})")]
    OwnedItemsFailed(String),
    #[error("you're not in a game or agent select. open valorant and get into a match, then try again")]
    NotInMatch,
    #[error("{0}")]
    Other(String),
}

impl From<String> for RiotClientError {
    fn from(message: String) -> Self {
        Self::Other(message)
    }
}

impl From<&str> for RiotClientError {
    fn from(message: &str) -> Self {
        Self::Other(message.to_string())
    }
}
