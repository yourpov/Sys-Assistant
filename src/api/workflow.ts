import { invoke } from '@tauri-apps/api/core';

import type { CheckOutcome, IssueReport, ManualAction, VanguardTraces, WorkflowAction } from '../types';

export function runAction(action: WorkflowAction): Promise<void> {
  return invoke('run_action', { action });
}

export function runManualAction(action: ManualAction): Promise<void> {
  return invoke('run_manual_action', { action });
}

export function runAccountSwap(accountIds: string[]): Promise<void> {
  return invoke('run_account_swap', { accountIds });
}

export function runLoader(): Promise<void> {
  return invoke('run_loader');
}

export function cancelAction(): Promise<void> {
  return invoke('cancel_action');
}

export function checkForIssues(): Promise<CheckOutcome> {
  return invoke('check_for_issues');
}

export function fixIssues(report: IssueReport): Promise<void> {
  return invoke('fix_issues', { report });
}

export function restartComputer(): Promise<void> {
  return invoke('restart_computer');
}

export function uninstallVanguard(): Promise<void> {
  return invoke('uninstall_vanguard');
}

export function reinstallVanguard(): Promise<void> {
  return invoke('reinstall_vanguard');
}

export function checkVanguardTraces(): Promise<VanguardTraces> {
  return invoke('check_vanguard_traces');
}

export function releaseWorkflowStop(): Promise<void> {
  return invoke('release_workflow_stop');
}
