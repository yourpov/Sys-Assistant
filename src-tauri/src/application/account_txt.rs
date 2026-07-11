use std::collections::HashMap;

use crate::domain::Account;
use crate::error::AppError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedAccountLine {
    pub label    : String,
    pub username : String,
    pub password : String,
}

fn password_needs_quoting(password: &str) -> bool {
    password.contains(':')
}

fn escape_password(password: &str) -> String {
    password.replace('\\', "\\\\").replace('"', "\\\"")
}

fn credentials_part(username: &str, password: &str) -> String {
    if password_needs_quoting(password) {
        format!("{username}:\"{}\"", escape_password(password))
    } else {
        format!("{username}:{password}")
    }
}

#[cfg(test)]
fn format_export_line(username: &str, password: &str, label: &str) -> String {
    let credentials = credentials_part(username, password);
    if label.trim().eq_ignore_ascii_case(username.trim()) {
        credentials
    } else {
        format!("{credentials} | {label}")
    }
}

pub fn build_export_text(accounts: &[Account], passwords: &[(String, String)]) -> String {
    let password_by_id: HashMap<&str, &str> = passwords.iter().map(|(id, password)| (id.as_str(), password.as_str())).collect();
    let mut rows = Vec::with_capacity(accounts.len());

    for account in accounts {
        let password = password_by_id.get(account.id.as_str()).copied().unwrap_or("");
        let credentials = credentials_part(&account.username, password);
        let has_label = !account.label.trim().eq_ignore_ascii_case(account.username.trim());
        rows.push((credentials, has_label.then(|| account.label.clone())));
    }

    let label_column_width = rows
        .iter()
        .filter_map(|(credentials, label)| label.as_ref().map(|_| credentials.chars().count()))
        .max()
        .unwrap_or(0);

    let lines: Vec<String> = rows
        .into_iter()
        .map(|(credentials, label)| match label {
            Some(label) => format!("{credentials:<label_column_width$} | {label}"),
            None => credentials,
        })
        .collect();

    let mut text = lines.join("\n");
    if !text.is_empty() {
        text.push('\n');
    }
    text
}

fn parse_quoted_password(value: &str) -> Result<String, AppError> {
    let mut chars = value.chars();
    if chars.next() != Some('"') {
        return Err(AppError::Account("expected opening quote".into()));
    }

    let mut out = String::new();
    while let Some(ch) = chars.next() {
        match ch {
            '"' => return Ok(out),
            '\\' => match chars.next() {
                Some('"') => out.push('"'),
                Some('\\') => out.push('\\'),
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => return Err(AppError::Account("unterminated quoted password".into())),
            },
            other => out.push(other),
        }
    }

    Err(AppError::Account("unterminated quoted password".into()))
}

fn parse_credentials(credentials: &str) -> Result<(String, String), AppError> {
    let credentials = credentials.trim();
    let Some(colon_idx) = credentials.find(':') else {
        return Err(AppError::Account("expected username:password".into()));
    };

    let username = credentials[..colon_idx].trim();
    if username.is_empty() {
        return Err(AppError::Account("username is empty".into()));
    }

    let password_part = credentials[colon_idx + 1..].trim();
    let password = if password_part.starts_with('"') {
        parse_quoted_password(password_part)?
    } else if password_part.is_empty() {
        return Err(AppError::Account("password is empty".into()));
    } else {
        password_part.to_string()
    };

    if password.is_empty() {
        return Err(AppError::Account("password is empty".into()));
    }

    Ok((username.to_string(), password))
}

pub fn parse_import_line(line: &str) -> Result<Option<ParsedAccountLine>, AppError> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return Ok(None);
    }

    let (credentials, pipe_label) = if let Some((left, right)) = trimmed.split_once('|') {
        (left.trim(), Some(right.trim()))
    } else {
        (trimmed, None)
    };

    let (username, password) = parse_credentials(credentials)?;

    let label = pipe_label
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| username.clone());

    Ok(Some(ParsedAccountLine {
        label,
        username,
        password,
    }))
}

pub fn parse_import_text(raw: &str) -> (Vec<ParsedAccountLine>, Vec<String>) {
    let mut parsed = Vec::new();
    let mut errors = Vec::new();

    for (index, line) in raw.lines().enumerate() {
        let line_no = index + 1;
        match parse_import_line(line) {
            Ok(None) => {}
            Ok(Some(entry)) => parsed.push(entry),
            Err(error) => errors.push(format!("line {line_no}: {}", error)),
        }
    }

    (parsed, errors)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_username_password_only() {
        let entry = parse_import_line("myaccount:mysecretpassword").unwrap().unwrap();
        assert_eq!(entry.username, "myaccount");
        assert_eq!(entry.password, "mysecretpassword");
        assert_eq!(entry.label, "myaccount");
    }

    #[test]
    fn parses_password_with_colons_unquoted_legacy() {
        let entry = parse_import_line("accountwithtag:importslike:secretWonders#Ta34")
            .unwrap()
            .unwrap();
        assert_eq!(entry.username, "accountwithtag");
        assert_eq!(entry.password, "importslike:secretWonders#Ta34");
        assert_eq!(entry.label, "accountwithtag");
    }

    #[test]
    fn parses_quoted_password_with_colons() {
        let entry = parse_import_line("DamniLoveMyKidd:\"Horcus:BestChamber\" | LoveuToDeathKid#death")
            .unwrap()
            .unwrap();
        assert_eq!(entry.username, "DamniLoveMyKidd");
        assert_eq!(entry.password, "Horcus:BestChamber");
        assert_eq!(entry.label, "LoveuToDeathKid#death");
    }

    #[test]
    fn parses_password_with_hash_but_no_colon() {
        let entry = parse_import_line("PixelStorm:BlueSky#918").unwrap().unwrap();
        assert_eq!(entry.username, "PixelStorm");
        assert_eq!(entry.password, "BlueSky#918");
        assert_eq!(entry.label, "PixelStorm");
    }

    #[test]
    fn parses_quoted_password_without_label() {
        let entry = parse_import_line("PixelStorm:\"BlueSky#918:Pixel#1842\"").unwrap().unwrap();
        assert_eq!(entry.username, "PixelStorm");
        assert_eq!(entry.password, "BlueSky#918:Pixel#1842");
        assert_eq!(entry.label, "PixelStorm");
    }

    #[test]
    fn parses_optional_label() {
        let entry = parse_import_line("myuser:mypass | secretWonders#Ta34").unwrap().unwrap();
        assert_eq!(entry.username, "myuser");
        assert_eq!(entry.password, "mypass");
        assert_eq!(entry.label, "secretWonders#Ta34");
    }

    #[test]
    fn parses_padded_pipe_export_line() {
        let entry = parse_import_line("DamniLoveMyKidd:HorcusBestChamber         | LoveuToDeathKid#death")
            .unwrap()
            .unwrap();
        assert_eq!(entry.username, "DamniLoveMyKidd");
        assert_eq!(entry.password, "HorcusBestChamber");
        assert_eq!(entry.label, "LoveuToDeathKid#death");
    }

    #[test]
    fn exports_with_and_without_label() {
        assert_eq!(format_export_line("myuser", "mypass", "myuser"), "myuser:mypass");
        assert_eq!(
            format_export_line("myuser", "mypass", "secretWonders#Ta34"),
            "myuser:mypass | secretWonders#Ta34"
        );
        assert_eq!(
            format_export_line("PixelStorm", "BlueSky#918:Pixel#1842", "PixelStorm"),
            "PixelStorm:\"BlueSky#918:Pixel#1842\""
        );
        assert_eq!(
            format_export_line("DamniLoveMyKidd", "HorcusBestChamber", "LoveuToDeathKid#death"),
            "DamniLoveMyKidd:HorcusBestChamber | LoveuToDeathKid#death"
        );
    }

    #[test]
    fn export_aligns_label_column() {
        let accounts = vec![
            Account {
                id          : "1".into(),
                label       : "myAccount".into(),
                username    : "myAccount".into(),
                notes       : None,
                full_access : true,
            },
            Account {
                id          : "2".into(),
                label       : "John#WICK".into(),
                username    : "EXAMPLE".into(),
                notes       : None,
                full_access : true,
            },
            Account {
                id          : "3".into(),
                label       : "LoveuToDeathKid#death".into(),
                username    : "DamniLoveMyKidd".into(),
                notes       : None,
                full_access : true,
            },
        ];
        let passwords = vec![
            ("1".into(), "MySecretPassword".into()),
            ("2".into(), "ACCOUNT123".into()),
            ("3".into(), "HorcusBestChamber".into()),
        ];

        let text = build_export_text(&accounts, &passwords);
        let lines: Vec<&str> = text.lines().collect();

        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0], "myAccount:MySecretPassword");
        assert!(lines[1].starts_with("EXAMPLE:ACCOUNT123"));
        assert!(lines[1].ends_with("| John#WICK"));
        assert!(lines[2].contains("DamniLoveMyKidd:HorcusBestChamber"));
        assert!(lines[2].ends_with("| LoveuToDeathKid#death"));

        let pipe_col = lines[1].find(" | ").expect("labeled export should include a pipe");
        assert_eq!(lines[2].find(" | "), Some(pipe_col));
    }

    #[test]
    fn roundtrips_user_export_sample() {
        let sample = r#"DamniLoveMyKidd:HorcusBestChamber | LoveuToDeathKid#death
PixelStorm:"BlueSky#918:Pixel#1842"
ShadowFox:Crimson!482"#;

        let (entries, errors) = parse_import_text(sample);
        assert!(errors.is_empty(), "{errors:?}");
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].password, "HorcusBestChamber");
        assert_eq!(entries[1].password, "BlueSky#918:Pixel#1842");
        assert_eq!(entries[2].password, "Crimson!482");
    }
}