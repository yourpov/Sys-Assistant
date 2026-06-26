#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IssueReport {
    pub riot_running: bool,
    pub stay_signed_in: bool,
    pub core_isolation_enabled: bool,
    pub missing_files: Vec<String>,
}

impl IssueReport {
    pub fn issue_count(&self) -> usize {
        (!self.riot_running as usize) + (!self.stay_signed_in as usize) + (!self.core_isolation_enabled as usize) + self.missing_files.len()
    }

    pub fn can_auto_fix(&self) -> bool {
        self.missing_files.is_empty() && self.core_isolation_enabled
    }
}

#[derive(Debug, Clone)]
pub enum CheckOutcome {
    NeedsReboot,
    Report(IssueReport),
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_report() -> IssueReport {
        IssueReport { riot_running: true, stay_signed_in: true, core_isolation_enabled: true, missing_files: vec![] }
    }

    #[test]
    fn no_issues_when_riot_running_and_files_present() {
        let report = base_report();
        assert_eq!(report.issue_count(), 0);
        assert!(report.can_auto_fix());
    }

    #[test]
    fn counts_riot_and_missing_files_as_issues() {
        let report = IssueReport { riot_running: false, missing_files: vec!["emu_installer.exe".to_string()], ..base_report() };
        assert_eq!(report.issue_count(), 2);
        assert!(!report.can_auto_fix());
    }

    #[test]
    fn counts_stay_signed_in_as_an_issue() {
        let report = IssueReport { stay_signed_in: false, ..base_report() };
        assert_eq!(report.issue_count(), 1);
        assert!(report.can_auto_fix());
    }

    #[test]
    fn core_isolation_off_is_an_issue_and_cannot_be_auto_fixed() {
        let report = IssueReport { core_isolation_enabled: false, ..base_report() };
        assert_eq!(report.issue_count(), 1);
        assert!(!report.can_auto_fix());
    }
}
