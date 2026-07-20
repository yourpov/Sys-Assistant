export type LogLevel = 'ok' | 'warn' | 'error' | 'info';

export interface LogLine {
  level    : LogLevel;
  message  : string;
  replace? : boolean;
}

export interface Settings {
  emuPath                       : string | null;
  loaderPath                    : string | null;
  tracexPath                    : string | null;
  isAlwaysOnTop                 : boolean;
  insertSimEnabled              : boolean;
  insertSimKeybind              : string | null;
  manualActionsEnabled          : ManualAction[];
  accountSwapPool               : string[];
  henrikApiKeys                 : string[];
  autoRunLoaderEnabled          : boolean;
  toastOsNotificationsEnabled   : boolean;
  confirmBeforeActionsEnabled   : boolean;
  hideAccountUsernames          : boolean;
  reduceAnimationsEnabled       : boolean;
  muteAlertSoundsEnabled        : boolean;
  accentColor                   : string | null;
}

export interface IssueReport {
  riotRunning  : boolean;
  staySignedIn : boolean;
  installTracex: boolean;
  missingFiles : string[];
}

export type CheckOutcome = { type: 'needsReboot' } | { type: 'report'; report: IssueReport };

export type WorkflowAction = 'start' | 'closeAll';

export type ManualAction =
  | 'toggleValorant'
  | 'toggleRiotClient'
  | 'openLoader'
  | 'changeSeed'
  | 'openEmuInstaller'
  | 'OpenTraceX'
  | 'restartValorant';

export type Page = 'automate' | 'accounts' | 'configs' | 'settings' | 'tools';

export type CollectionCategory = 'weapon_skins' | 'gun_buddies' | 'player_cards' | 'sprays' | 'titles';

export interface CollectionCategoryCounts {
  weaponSkins : number;
  gunBuddies  : number;
  playerCards : number;
  sprays      : number;
  titles      : number;
}

export interface CollectionWeapon {
  id                    : string;
  name                  : string;
  iconUrl               : string | null;
  defaultSkinId         : string;
  defaultSkinName       : string;
  defaultSkinIconUrl    : string | null;
  defaultSkinPreviewUrl : string | null;
  weaponClass           : string;
  sortOrder             : number;
  fireRate              : number | null;
  magazineSize          : number | null;
  reloadTimeSeconds     : number | null;
  equipTimeSeconds      : number | null;
  wallPenetration       : string | null;
  headDamage            : number | null;
  bodyDamage            : number | null;
  shopCost              : number | null;
  totalSkinCount        : number;
}

export interface CollectionSkinVariant {
  id          : string;
  displayName : string;
  iconUrl     : string | null;
  previewUrl  : string | null;
  swatchUrl   : string | null;
  videoUrl    : string | null;
  owned       : boolean;
}

export interface CollectionItem {
  id              : string;
  name            : string;
  iconUrl         : string | null;
  previewUrl      : string | null;
  category        : CollectionCategory | string;
  weaponId        : string | null;
  skinId          : string | null;
  contentTierUuid : string | null;
  isDefault       : boolean;
  variants        : CollectionSkinVariant[];
}

export interface RiotClientStatus {
  running  : boolean;
  loggedIn : boolean;
}

export interface CollectionSnapshot {
  accountName    : string | null;
  accountTag     : string | null;
  weapons        : CollectionWeapon[];
  items          : CollectionItem[];
  counts         : CollectionCategoryCounts;
  totals         : CollectionCategoryCounts;
  catalogLoaded  : boolean;
  catalogWarning : string | null;
  sessionWarning : string | null;
}

export type ToolsTab = 'Lookup' | 'Match' | 'Monitor' | 'Collection' | 'Compare';
export type ToolsMatchSection = 'Lobby' | 'Saved';
export type SettingsTab = 'General' | 'Automation' | 'Tools' | 'About';

export interface SavedPlayer {
  id           : string;
  name         : string;
  tag          : string;
  rank         : string | null;
  rr           : number | null;
  rankIconUrl  : string | null;
  agent        : string | null;
  agentIconUrl : string | null;
  savedAt      : string;
}

export interface Account {
  id         : string;
  label      : string;
  username   : string;
  hasSession : boolean;
  notes      : string | null;
  fullAccess : boolean;
  category   : string | null;
  region     : string | null;
}

export interface AppCredit {
  username          : string;
  displayName       : string;
  avatarDataUrl     : string;
  decorationDataUrl : string | null;
  status            : string;
  activityText      : string | null;
}

export interface AccountLookupExtras {
  gamesPlayed   : number;
  winRate       : number;
  kda           : number;
  avgHsPercent  : number;
  totalKills    : number;
  totalDeaths   : number;
  totalAssists  : number;
  topAgents     : AgentSummary[];
  recentMatches : MatchSummary[];
  seasons       : SeasonStats[];
}

export interface AccountLookup {
  name          : string;
  tag           : string;
  region        : string;
  accountLevel  : number;
  cardUrl       : string;
  lastUpdate    : string;
  rank          : string | null;
  rankIconUrl   : string | null;
  rr            : number | null;
  elo           : number | null;
  peakRank      : string | null;
  gamesPlayed   : number;
  winRate       : number;
  kda           : number;
  avgHsPercent  : number;
  totalKills    : number;
  totalDeaths   : number;
  totalAssists  : number;
  topAgents     : AgentSummary[];
  recentMatches : MatchSummary[];
  seasons       : SeasonStats[];
}

export interface SeasonStats {
  seasonId             : string;
  seasonLabel          : string;
  rank                 : string;
  wins                 : number;
  games                : number;
  winRate              : number;
  leaderboardPlacement : number | null;
}

export interface AgentSummary {
  agent        : string;
  agentIconUrl : string;
  games        : number;
  wins         : number;
  kills        : number;
  deaths       : number;
}

export interface MatchSummary {
  map          : string;
  mapIconUrl   : string;
  mode         : string;
  date         : number;
  result       : string;
  kills        : number;
  deaths       : number;
  assists      : number;
  hsPercent    : number;
  teamScore    : number;
  enemyScore   : number;
  agent        : string;
  agentIconUrl : string;
}

export interface MatchInfo {
  inGame  : boolean;
  players : MatchPlayer[];
}

export interface MatchPlayer {
  name         : string;
  tag          : string;
  rank         : string | null;
  rr           : number | null;
  rankIconUrl  : string | null;
  teamSide     : string | null;
  ally         : boolean;
  agent        : string | null;
  agentIconUrl : string | null;
}

export interface LiveMatchSnapshot {
  inMatch         : boolean;
  mapName         : string | null;
  region          : string | null;
  roundsCompleted : number;
}

export interface ValorantVersion {
  branch            : string;
  gameVersion       : string;
  buildNumber       : number;
  riotClientVersion : string;
  label             : string;
}

export interface ValorantVersionStatus {
  latest : ValorantVersion | null;
  local  : ValorantVersion | null;
}

export interface AuthSession {
  userId           : string;
  discordUsername  : string | null;
  discordAvatarUrl : string | null;
  isGuest          : boolean;
}

export type ConfigType = 'legit' | 'semi_legit' | 'semi_rage' | 'rage';
export type ConfigPerspective = 'first_person' | 'third_person';

export interface CommunityConfig {
  id               : string;
  name             : string;
  note             : string | null;
  data             : unknown;
  type             : ConfigType | null;
  perspective      : ConfigPerspective | null;
  userId           : string | null;
  discordUsername  : string | null;
  discordAvatarUrl : string | null;
  likes            : number;
  dislikes         : number;
  commentCount     : number;
  createdAt        : string;
}

export interface CommunityComment {
  id               : string;
  userId           : string | null;
  parentId         : string | null;
  discordUsername  : string | null;
  discordAvatarUrl : string | null;
  body             : string;
  replyCount       : number;
  createdAt        : string;
  updatedAt        : string;
}

export interface CommentsPage {
  comments   : CommunityComment[];
  hasMore    : boolean;
  totalCount : number | null;
}
