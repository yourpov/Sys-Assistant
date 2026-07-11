import type { NotificationContent } from '../hooks/useToastStore';
import type { IssueReport }         from '../types';

export function issueCount(report: IssueReport): number {
  return (
    (!report.riotRunning ? 1 : 0) +
    (!report.staySignedIn ? 1 : 0) +
    (!report.coreIsolationEnabled ? 1 : 0) +
    report.missingFiles.length
  );
}

export function canAutoFix(report: IssueReport): boolean {
  return report.missingFiles.length === 0 && report.coreIsolationEnabled;
}

export function hasIssues(report: IssueReport): boolean {
  return issueCount(report) > 0;
}

export function issueSummary(report: IssueReport): string {
  const count = issueCount(report);
  return `${count} issue${count === 1 ? '' : 's'}`;
}

export function fixBody(report: IssueReport): string {
  const parts: string[] = [];
  if (!report.riotRunning) parts.push("the Riot Client isn't running");
  if (!report.staySignedIn) parts.push('"Stay signed in" isn\'t enabled in the Riot Client');
  if (!report.coreIsolationEnabled) parts.push('Core isolation (Memory integrity) is off');
  if (report.missingFiles.length > 0) {
    parts.push(`${report.missingFiles.join(' and ')} ${report.missingFiles.length === 1 ? 'is' : 'are'} missing from this folder`);
  }
  const sentence        = parts.join(', and ');
  const capitalized     = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  const notes: string[] = [];
  if (!report.coreIsolationEnabled) {
    notes.push(" Core isolation can't be turned on automatically. enable it in Windows Security > Device security, then restart.");
  }
  if (report.missingFiles.length > 0) {
    notes.push(" Missing files can't be fixed automatically. Add them to this app's folder and check again.");
  }
  return `${capitalized}.${notes.join('')}`;
}

export function issuesFoundNotice(report: IssueReport): NotificationContent {
  return { title: `${issueSummary(report)} found`, body: fixBody(report) };
}