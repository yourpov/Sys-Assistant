import type { NotificationContent } from '../hooks/useToastStore';
import type { IssueReport }         from '../types';

export function issueCount(report: IssueReport): number {
  return (
    (!report.riotRunning ? 1 : 0) +
    (!report.staySignedIn ? 1 : 0) +
    (report.installTracex ? 1 : 0) +
    report.missingFiles.length
  );
}

function joinClauses(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function canAutoFix(report: IssueReport): boolean {
  return report.missingFiles.length === 0;
}

export function hasIssues(report: IssueReport): boolean {
  return issueCount(report) > 0;
}

export function issueSummary(report: IssueReport): string {
  const count = issueCount(report);
  return `${count} issue${count === 1 ? '' : 's'}`;
}

export function fixBody(report: IssueReport): string {
  const problems: string[] = [];
  if (!report.riotRunning) problems.push("the Riot Client isn't running");
  if (report.installTracex) problems.push("tracex.exe isn't installed");
  if (!report.staySignedIn) problems.push('"Stay signed in" isn\'t enabled in the Riot Client');
  if (report.missingFiles.length > 0) {
    problems.push(`${joinClauses(report.missingFiles)} ${report.missingFiles.length === 1 ? 'is' : 'are'} missing from this folder`);
  }

  const sentence    = joinClauses(problems);
  const capitalized = sentence.charAt(0).toUpperCase() + sentence.slice(1);

  const actions: string[] = [];
  if (!report.riotRunning) actions.push('start the Riot Client');
  if (report.installTracex) actions.push('run emu_installer to install TraceX');
  if (!report.staySignedIn) actions.push('turn on "Stay signed in"');

  const tail: string[] = [];
  if (actions.length > 0) tail.push(`Want to ${joinClauses(actions)}?`);
  if (report.missingFiles.length > 0) {
    tail.push("Those files can't be added automatically. drop them in this app's folder, then check again.");
  }

  return [`${capitalized}.`, ...tail].join(' ');
}

export function issuesFoundNotice(report: IssueReport): NotificationContent {
  return { title: `${issueSummary(report)} found`, body: fixBody(report) };
}