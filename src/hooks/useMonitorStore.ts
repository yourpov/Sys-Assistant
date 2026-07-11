import { useSyncExternalStore } from 'react';

import { lookupAccount }     from '../api/tools';
import type { MatchSummary } from '../types';
import { getMuteAlertSounds }                                          from '../utils/alertSoundPreference';
import { parseRiotId } from '../utils/playerId';
import { EMPTY_RIOT_ID_ERROR, parseInvokeError, type UserFacingError } from '../utils/userError';
import { toast }                                  from './useToastStore';

export type MonitorMetric = 'hsPercent' | 'kills'   | 'deaths' | 'assists';
export type IntervalUnit  = 'seconds'   | 'minutes' | 'hours';

export interface MonitorConfig {
  riotId          : string;
  autoCheckEnabled: boolean;
  intervalValue   : number;
  intervalUnit    : IntervalUnit;
  metric          : MonitorMetric;
  threshold       : number;
}

const STATE_KEY = 'tools-monitor-config';

const DEFAULT_CONFIG: MonitorConfig = {
  riotId          : '',
  autoCheckEnabled: false,
  intervalValue   : 5,
  intervalUnit    : 'minutes',
  metric          : 'hsPercent',
  threshold       : 50,
};

export const INTERVAL_UNIT_MS: Record<IntervalUnit, number> = {
  seconds: 1000,
  minutes: 60 * 1000,
  hours  : 60 * 60 * 1000,
};

const MONITOR_METRIC_LABELS: Record<MonitorMetric, string> = {
  hsPercent: 'Headshot %',
  kills    : 'Kills',
  deaths   : 'Deaths',
  assists  : 'Assists',
};

export const MONITOR_METRIC_SUFFIX: Record<MonitorMetric, string> = {
  hsPercent: '%',
  kills    : '',
  deaths   : '',
  assists  : '',
};

export function monitorMetricLabel(metric: MonitorMetric): string {
  return MONITOR_METRIC_LABELS[metric];
}

function loadConfig(): MonitorConfig {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) }: DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function playAlertSound() {
  if (getMuteAlertSounds()) return;
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const oscillator                 = ctx.createOscillator();
      const gain                       = ctx.createGain();
            oscillator.frequency.value = freq;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      const start = now + i * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
  }
}

function matchKey(match: MatchSummary): string {
  return `${match.date}-${match.map}`;
}

interface State {
  config       : MonitorConfig;
  checking     : boolean;
  error        : UserFacingError | null;
  lastMatch    : MatchSummary | null;
  lastCheckedAt: Date | null;
}

let   state: State                                      = { config: loadConfig(), checking: false, error: null, lastMatch: null, lastCheckedAt: null };
let   seenMatchKey: string | null                       = null;
let   intervalId: ReturnType<typeof setInterval> | null = null;
let   checkGeneration                                   = 0;
const listeners                                         = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}
function snapshot() {
  return state;
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function persist() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state.config));
  } catch {
  }
}

function restartInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  const { autoCheckEnabled, riotId, intervalValue, intervalUnit } = state.config;
  if (!autoCheckEnabled || !riotId.includes('#')) return;
  const ms         = Math.max(1000, intervalValue * INTERVAL_UNIT_MS[intervalUnit]);
        intervalId = setInterval(() => runCheck(), ms);
}

async function runCheckFor(riotIdQuery: string) {
  const parsed = parseRiotId(riotIdQuery);
  if (!parsed) {
    state = { ...state, error: EMPTY_RIOT_ID_ERROR };
    emit();
    return;
  }

  const [name, tag] = parsed;
  const generation  = ++checkGeneration;
  const metric      = state.config.metric;
  const threshold   = state.config.threshold;

  state = { ...state, checking: true, error: null };
  emit();
  try {
    const account = await lookupAccount(name, tag);
    if (generation !== checkGeneration) return;
    const latest  = account.recentMatches[0] ?? null;
          state   = { ...state, lastMatch: latest, lastCheckedAt: new Date() };

    if (latest) {
      const key          = matchKey(latest);
      const isNewMatch   = seenMatchKey !== null && seenMatchKey !== key;
      const isFirstCheck = seenMatchKey === null;
            seenMatchKey = key;

      const value = latest[metric];
      if ((isNewMatch || isFirstCheck) && value > threshold) {
        const metricLabel = monitorMetricLabel(metric);
        const suffix      = MONITOR_METRIC_SUFFIX[metric];
        toast.success({
          title: `${metricLabel} alert`,
          body : `Your last match has ${value}${suffix} ${metricLabel} on ${latest.map} (${latest.mode})`,
        });
        playAlertSound();
      }
    }
  } catch (e) {
    if (generation !== checkGeneration) return;
    state = { ...state, error: parseInvokeError(e) };
  } finally {
    if (generation === checkGeneration) {
      state = { ...state, checking: false };
      emit();
    }
  }
}

function runCheck() {
  void runCheckFor(state.config.riotId);
}

function setConfig(next: Partial<MonitorConfig>) {
  state = { ...state, config: { ...state.config, ...next } };
  persist();
  restartInterval();
  emit();
}

function setRiotId(riotId: string) {
  seenMatchKey = null;
  setConfig({ riotId });
}

function pickSavedAccount(riotId: string) {
  seenMatchKey = null;
  setConfig({ riotId });
  if (riotId) void runCheckFor(riotId);
}

restartInterval();

export const monitor = { setConfig, setRiotId, pickSavedAccount, runCheck };

export function useMonitorStore() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
