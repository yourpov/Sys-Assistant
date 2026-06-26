export type LogLevel = 'ok' | 'warn' | 'error' | 'info';

export interface LogLine {
  level: LogLevel;
  message: string;
}

export interface Settings {
  tempValWaitSecs: number;
  seshWaitSecs: number;
  emuPath: string | null;
  loaderPath: string | null;
  seshPath: string | null;
  isAlwaysOnTop: boolean;
  insertSimEnabled: boolean;
  insertSimKeybind: string | null;
  manualActionsEnabled: ManualAction[];
  accountSwapPool: string[];
  henrikApiKeys: string[];
}

export interface IssueReport {
  riotRunning: boolean;
  staySignedIn: boolean;
  coreIsolationEnabled: boolean;
  missingFiles: string[];
}

export type CheckOutcome = { type: 'needsReboot' } | { type: 'report'; report: IssueReport };

export type WorkflowAction = 'startWithRestart' | 'startWithoutRestart' | 'fix55Error' | 'closeAll';

export type ManualAction =
  | 'toggleValorant'
  | 'toggleRiotClient'
  | 'openLoader'
  | 'changeSeed'
  | 'openEmuInstaller'
  | 'restartValorant'
  | 'createSession';

export type Page = 'automate' | 'accounts' | 'configs' | 'settings' | 'tools' | 'changelogs';

export interface Account {
  id: string;
  label: string;
  username: string;
  hasSession: boolean;
}

export interface AppCredit {
  username: string;
  displayName: string;
  avatarDataUrl: string;
  decorationDataUrl: string | null;
  status: string;
  activityText: string | null;
}

export interface AccountLookup {
  name: string;
  tag: string;
  region: string;
  accountLevel: number;
  cardUrl: string;
  lastUpdate: string;
  rank: string | null;
  rankIconUrl: string | null;
  rr: number | null;
  elo: number | null;
  peakRank: string | null;
  gamesPlayed: number;
  winRate: number;
  kda: number;
  avgHsPercent: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  topAgents: AgentSummary[];
  recentMatches: MatchSummary[];
}

export interface AgentSummary {
  agent: string;
  agentIconUrl: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
}

export interface MatchSummary {
  map: string;
  mode: string;
  date: number;
  result: string;
  kills: number;
  deaths: number;
  assists: number;
  hsPercent: number;
  teamScore: number;
  enemyScore: number;
  agent: string;
  agentIconUrl: string;
}

export interface MatchInfo {
  inGame: boolean;
  players: MatchPlayer[];
}

export interface MatchPlayer {
  name: string;
  tag: string;
  rank: string | null;
  rr: number | null;
  teamSide: string | null;
  ally: boolean;
  agent: string | null;
  agentIconUrl: string | null;
}
