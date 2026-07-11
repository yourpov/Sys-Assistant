import type { LogLine } from '../types';

export type AutomatePillState = 'ready' | 'running' | 'warning' | 'failed';

const PILL_LABELS: Record<AutomatePillState, string> = {
  ready  : 'Ready',
  running: 'Running',
  warning: 'Warning',
  failed : 'Failed',
};

const PILL_SUBTITLES: Record<AutomatePillState, string> = {
  ready  : 'Idle. Pick an action below.',
  running: 'Action in progress',
  warning: 'Check the console for details.',
  failed : 'Last action failed. See console.',
};

export function resolveAutomatePillState(
  running: boolean,
  swapPreparing: boolean,
  lines: LogLine[],
): AutomatePillState {
  if (running) return 'running';
  if (swapPreparing) return 'warning';

  const last = [...lines].reverse().find((line) => line.level === 'error' || line.level === 'warn');
  if (last?.level === 'error') return 'failed';
  if (last?.level === 'warn') return 'warning';
  return 'ready';
}

export function automatePillLabel(state: AutomatePillState, swapPreparing = false): string {
  if (state === 'warning' && swapPreparing) return 'Preparing';
  return PILL_LABELS[state];
}

export function automatePillSubtitle(state: AutomatePillState, swapPreparing = false): string {
  if (state === 'warning' && swapPreparing) return 'Switching account';
  return PILL_SUBTITLES[state];
}