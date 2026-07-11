#[derive(Debug, Clone)]
pub struct Account {
    pub id          : String,
    pub label       : String,
    pub username    : String,
    pub notes       : Option<String>,
    pub full_access : bool,
}
