import { openUrl }                                  from '@tauri-apps/plugin-opener';
import { AnimatePresence, motion }                  from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

import { listAccounts }                     from '../api/accounts';
import { addSavedPlayer, listSavedPlayers } from '../api/savedPlayers';
import {
  detectCurrentAccountProfile,
  fetchLiveMatchSnapshot,
  fetchMatchInfo,
  lookupAccount,
  lookupAccountExtras,
  lookupAccountProfile,
} from '../api/tools';

import { useValorantVersion } from '../hooks/useValorantVersion';
import {
  monitor,
  MONITOR_METRIC_SUFFIX,
  monitorMetricLabel,
  useMonitorStore,
  type IntervalUnit,
  type MonitorConfig,
  type MonitorMetric,
} from '../hooks/useMonitorStore';
import { toast } from '../hooks/useToastStore';
import type {
  Account,
  AccountLookup,
  LiveMatchSnapshot,
  MatchInfo,
  MatchPlayer,
  SavedPlayer,
  SeasonStats,
  ToolsMatchSection,
  ToolsTab,
} from '../types';

import { TOOLS_LOOKUP_WINDOW_SIZE }                                   from '../constants/windowSizes';
import { parseRiotId, playerKey }                                     from '../utils/playerId';
import { logSilentFailure }                                           from '../utils/silentError';
import { notifySavedPlayersChanged, onSavedPlayersChanged }           from '../utils/savedPlayersEvents';
import { BASE_WINDOW_SIZE, tweenWindowSize }                          from '../utils/windowSize';
import {
  EMPTY_RIOT_ID_ERROR,
  isRateLimitedError,
  parseInvokeError,
  toastFromError,
  type UserFacingError,
} from '../utils/userError';
import { Dropdown, type DropdownOption }                              from './Dropdown';
import { ToolsInvokeError }                                           from './ErrorDisplay';
import { PageHero }                                                   from './PageHero';
import { CollectionTool }                                             from './CollectionTool';
import { SavedPlayersTool }                                           from './SavedPlayersTool';
import { ValorantVersionInline }                                      from './ValorantVersionStrip';
import { LiveMatchPills, ToolsEmpty, ToolsPanel, ToolsSubsectionBar } from './ToolsUi';
import { PlayerComparisonTool }                                       from './PlayerComparisonTool';
import { Skeleton }                                                   from './Skeleton';
import { Tooltip }                                                    from './Tooltip';

const TOOL_CATEGORIES: readonly ToolsTab[]         = ['Lookup', 'Match', 'Monitor', 'Collection', 'Compare'];
const MATCH_SECTIONS: readonly ToolsMatchSection[] = ['Lobby', 'Saved'];
const LIVE_MATCH_POLL_MS                           = 5000;

function useLiveMatchSnapshot() {
  const [snapshot, setSnapshot] = useState<LiveMatchSnapshot | null>(null);
  const [error, setError]       = useState<UserFacingError | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let   cancelled = false;
    const poll      = () => {
      fetchLiveMatchSnapshot()
        .then((next) => {
          if (cancelled) return;
          setSnapshot(next);
          setError(null);
          setLoading(false);
        })
        .catch((e) => {
          if (!cancelled) {
            setError(parseInvokeError(e));
            setLoading(false);
          }
        });
    };
    poll();
    const id = setInterval(poll, LIVE_MATCH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { snapshot, error, loading };
}

const matchDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const HISTORY_KEY          = 'tools-lookup-history';
const LOOKUP_STATE_KEY     = 'tools-lookup-last';
const MATCH_INFO_STATE_KEY = 'tools-matchinfo-last';
const MAX_HISTORY          = 12;
const MATCHES_PER_PAGE     = 10;

const INTERVAL_UNIT_OPTIONS: DropdownOption[] = [
  { value: 'seconds', label: 'seconds' },
  { value: 'minutes', label: 'minutes' },
  { value: 'hours', label: 'hours' },
];

const MONITOR_METRIC_OPTIONS: DropdownOption[] = [
  { value: 'hsPercent', label: 'Headshot %' },
  { value: 'kills', label: 'Kills' },
  { value: 'deaths', label: 'Deaths' },
  { value: 'assists', label: 'Assists' },
];

interface HistoryEntry {
  name: string;
  tag : string;
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw): [];
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function loadSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw): null;
  } catch {
    return null;
  }
}

function saveSession<T>(key: string, value: T | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

function vtlUrl(name: string, tag: string): string {
  return `https://vtl.lol/id/${name}_${tag}`;
}

function trackerUrl(name: string, tag: string): string {
  return `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(name)}%23${encodeURIComponent(tag)}/overview`;
}

type SavePlayerPayload = Pick<MatchPlayer, 'name' | 'tag' | 'rank' | 'rr' | 'rankIconUrl' | 'agent' | 'agentIconUrl'>;

function lookupToSavePayload(result: AccountLookup): SavePlayerPayload {
  const featured = result.topAgents[0] ?? result.recentMatches[0];
  return {
    name        : result.name,
    tag         : result.tag,
    rank        : result.rank,
    rr          : result.rr,
    rankIconUrl : result.rankIconUrl,
    agent       : featured?.agent ?? null,
    agentIconUrl: featured?.agentIconUrl ?? null,
  };
}

function savePayloadFingerprint(player: SavePlayerPayload): string {
  return [
    playerKey(player.name, player.tag),
    player.rank ?? '',
    player.rr ?? '',
    player.rankIconUrl ?? '',
    player.agent ?? '',
    player.agentIconUrl ?? '',
  ].join('|');
}

function useSavedPlayerBookmarks() {
  const [savedPlayerKeys, setSavedPlayerKeys] = useState<Set<string>>(new Set());
  const [savingPlayerKey, setSavingPlayerKey] = useState<string | null>(null);
  const savedPlayerKeysRef                    = useRef(savedPlayerKeys);

  useEffect(() => {
    savedPlayerKeysRef.current = savedPlayerKeys;
  }, [savedPlayerKeys]);

  const reloadSavedPlayerKeys = useCallback(async () => {
    try {
      const saved = await listSavedPlayers();
      setSavedPlayerKeys(new Set(saved.map((player) => playerKey(player.name, player.tag))));
    } catch {
      setSavedPlayerKeys(new Set());
    }
  }, []);

  useEffect(() => {
    void reloadSavedPlayerKeys();
    return onSavedPlayersChanged(() => {
      void reloadSavedPlayerKeys();
    });
  }, [reloadSavedPlayerKeys]);

  const upsertPlayer = useCallback(async (player: SavePlayerPayload, options?: { silent?: boolean }) => {
    const key          = playerKey(player.name, player.tag);
    const alreadySaved = savedPlayerKeysRef.current.has(key);

    setSavingPlayerKey(key);
    try {
      await addSavedPlayer(player);
      setSavedPlayerKeys((prev) => new Set([...prev, key]));
      notifySavedPlayersChanged();
      if (!options?.silent) {
        toast.success({
          title: alreadySaved ? 'Saved player updated': 'Player saved',
          body : alreadySaved
            ? `${player.name}#${player.tag} was refreshed with the latest info.`
            :  `${player.name}#${player.tag} was added to your collection.`,
        });
      }
    } catch (e) {
      if (!options?.silent) {
        toast.error(toastFromError(e, {
          title: alreadySaved ? "Couldn't update saved player" : "Couldn't save player",
        }));
      }
    } finally {
      setSavingPlayerKey(null);
    }
  }, []);

  const savePlayer = useCallback((player: SavePlayerPayload) => upsertPlayer(player), [upsertPlayer]);

  const syncSavedPlayerIfBookmarked = useCallback(
    async (player: SavePlayerPayload) => {
      const key     = playerKey(player.name, player.tag);
      let   isSaved = savedPlayerKeysRef.current.has(key);
      if (!isSaved) {
        try {
          const saved = await listSavedPlayers();
          const keys  = new Set(saved.map((entry) => playerKey(entry.name, entry.tag)));
          setSavedPlayerKeys(keys);
          isSaved = keys.has(key);
        } catch {
          return;
        }
      }
      if (!isSaved) return;
      await upsertPlayer(player, { silent: true });
    },
    [upsertPlayer],
  );

  return { savedPlayerKeys, savingPlayerKey, savePlayer, syncSavedPlayerIfBookmarked };
}

interface Props {
  initialQuery           ?                         : string | null;
  onInitialQueryConsumed ?                         : () => void;
  initialTab             ?                         : ToolsTab | null;
  initialMatchSection    ?                         : ToolsMatchSection | null;
                         onToolsNavigationConsumed?: () => void;
  onOpenSettings         ?                         : () => void;
}

export function ToolsPage({
  initialQuery,
  onInitialQueryConsumed,
  initialTab,
  initialMatchSection,
  onToolsNavigationConsumed,
  onOpenSettings,
}: Props) {

  const [category, setCategory]         = useState<ToolsTab>(initialTab ?? 'Lookup');
  const [matchSection, setMatchSection] = useState<ToolsMatchSection>(initialMatchSection ?? 'Lobby');
  const [lookupQuery, setLookupQuery]   = useState<string | null>(initialQuery ?? null);

  useEffect(() => {
    if (!initialQuery) return;
    setCategory('Lookup');
    setLookupQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!initialTab && !initialMatchSection) return;
    if (initialTab) setCategory(initialTab);
    if (initialMatchSection) setMatchSection(initialMatchSection);
    onToolsNavigationConsumed?.();
  }, [initialTab, initialMatchSection, onToolsNavigationConsumed]);

  const openLookup = (riotId: string) => {
    setCategory('Lookup');
    setLookupQuery(riotId);
  };

  const collectionActive = category === 'Collection';

  return (
    <main className = {`tools-page${collectionActive ? ' tools-page--collection' : ''}`} data-tauri-drag-region>
    <div  className = {`tools-content${collectionActive ? ' tools-content--wide' : ''}`} data-tauri-drag-region>
        <PageHero
          title   = "Tools"
          actions = {
            onOpenSettings ? (
              <button type = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {onOpenSettings}>
                API keys
              </button>
            ) : undefined
          }
        />

        <div className = "app-tab-bar app-tab-bar--cols-5 drag-surface" role = "tablist" data-tauri-drag-region>
          {TOOL_CATEGORIES.map((id) => (
            <button
              key           = {id}
              type          = "button"
              role          = "tab"
              aria-selected = {id === category}
              className     = {`app-tab-button${id === category ? ' active' : ''}`}
              onClick       = {() => setCategory(id)}
            >
              {id}
            </button>
          ))}
        </div>

        <AnimatePresence mode = "wait">
          <motion.div
            key       = {category}
            className = "app-tab-panel drag-surface"
            data-tauri-drag-region
            initial    = {{ opacity: 0, y: 6 }}
            animate    = {{ opacity: 1, y: 0 }}
            exit       = {{ opacity: 0, y: -6, transition: { duration: 0.1 } }}
            transition = {{ duration: 0.18, ease: 'easeOut' }}
          >
            {category === 'Lookup' && (
              <LookupTool
                initialQuery           = {lookupQuery}
                onInitialQueryConsumed = {() => {
                  setLookupQuery(null);
                  onInitialQueryConsumed?.();
                }}
                onOpenSettings = {onOpenSettings}
              />
            )}
            {category === 'Match' && (
              <MatchTool
                section         = {matchSection}
                onSectionChange = {setMatchSection}
                onOpenSettings  = {onOpenSettings}
                onLookup        = {openLookup}
              />
            )}
            {category === 'Monitor' && <MonitorTool onOpenSettings={onOpenSettings} />}
            {category === 'Collection' && <CollectionTool />}
            {category === 'Compare' && <PlayerComparisonTool onOpenSettings={onOpenSettings} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

interface StoredLookupState {
  riotId   : string;
  result   : AccountLookup | null;
  lastQuery: { name: string; tag: string } | null;
}

function LookupTool({ initialQuery, onInitialQueryConsumed, onOpenSettings }: Props) {
  const [riotId, setRiotId]                 = useState(() => initialQuery ?? loadSession<StoredLookupState>(LOOKUP_STATE_KEY)?.riotId ?? '');
  const [loading, setLoading]               = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError]                   = useState<UserFacingError | null>(null);
  const [result, setResult]                 = useState<AccountLookup | null>(() =>
    initialQuery ? null: loadSession<StoredLookupState>(LOOKUP_STATE_KEY)?.result ?? null,
  );
  const [lastQuery, setLastQuery] = useState<{ name: string; tag: string } | null>(() =>
    initialQuery ? null: loadSession<StoredLookupState>(LOOKUP_STATE_KEY)?.lastQuery ?? null,
  );
  const [history, setHistory]                                                         = useState<HistoryEntry[]>(() => loadHistory());
  const [matchPage, setMatchPage]                                                     = useState(0);
  const { savedPlayerKeys, savingPlayerKey, savePlayer, syncSavedPlayerIfBookmarked } = useSavedPlayerBookmarks();
  const lastSyncedFingerprintRef                                                      = useRef<string | null>(null);
  const lookupRequestRef                                                              = useRef(0);

  useEffect(() => {
    const size = result || loading ? TOOLS_LOOKUP_WINDOW_SIZE : BASE_WINDOW_SIZE;
    tweenWindowSize(size.width, size.height);
  }, [result, loading]);

  useEffect(() => {
    return () => {
      tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height);
    };
  }, []);

  useEffect(() => {
    saveSession<StoredLookupState>(LOOKUP_STATE_KEY, { riotId, result, lastQuery });
  }, [riotId, result, lastQuery]);

  useEffect(() => {
    if (!initialQuery) return;
    setRiotId(initialQuery);
    onInitialQueryConsumed?.();
    void handleLookup(initialQuery);
  }, [initialQuery]);

  const applyResult = (account: AccountLookup) => {
    setResult(account);
    setRiotId(`${account.name}#${account.tag}`);
    setMatchPage(0);
    setHistory((prev) => {
      const next = [
        { name: account.name, tag: account.tag },
        ...prev.filter((h) => !(h.name.toLowerCase() === account.name.toLowerCase() && h.tag.toLowerCase() === account.tag.toLowerCase())),
      ].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  };

  const syncLookupResult = useCallback(
    async (account: AccountLookup) => {
      const payload     = lookupToSavePayload(account);
      const fingerprint = savePayloadFingerprint(payload);
      if (lastSyncedFingerprintRef.current === fingerprint) return;
      lastSyncedFingerprintRef.current = fingerprint;
      await syncSavedPlayerIfBookmarked(payload);
    },
    [syncSavedPlayerIfBookmarked],
  );

  const loadAccountDetails = async (name: string, tag: string, region: string, base: AccountLookup, requestId: number) => {
    setDetailsLoading(true);
    try {
      const extras = await lookupAccountExtras(name, tag, region);
      if (requestId !== lookupRequestRef.current) return;
      const merged = { ...base, ...extras };
      setResult(merged);
      await syncLookupResult(merged);
    } catch (e) {
      if (requestId !== lookupRequestRef.current) return;
      toast.warning(toastFromError(e, { title: "Couldn't load match history", icon: 'warning' }));
      await syncLookupResult(base);
    } finally {
      if (requestId === lookupRequestRef.current) setDetailsLoading(false);
    }
  };

  const handleLookup = async (queryOverride?: string) => {
    const parsed = parseRiotId(queryOverride ?? riotId);
    if (!parsed) {
      setError(EMPTY_RIOT_ID_ERROR);
      return;
    }
    const [name, tag] = parsed;
    const requestId   = ++lookupRequestRef.current;

    setLoading(true);
    setDetailsLoading(false);
    setError(null);
    setLastQuery({ name, tag });
    const loadingToastId = toast.info({ title: 'Looking up account...', body: 'Loading profile first, then match history.' });
    try {
      const profile = await lookupAccountProfile(name, tag);
      if (requestId !== lookupRequestRef.current) return;
      applyResult(profile);
      setLoading(false);
      toast.dismiss(loadingToastId);
      await loadAccountDetails(profile.name, profile.tag, profile.region, profile, requestId);
    } catch (e) {
      if (requestId !== lookupRequestRef.current) return;
      setError(parseInvokeError(e));
      setResult(null);
      setLoading(false);
      toast.dismiss(loadingToastId);
    }
  };

  const handleDetect = async () => {
    const requestId = ++lookupRequestRef.current;
    setLoading(true);
    setDetailsLoading(false);
    setError(null);
    const loadingToastId = toast.info({ title: 'Detecting your account...', body: 'Loading profile first, then match history.' });
    try {
      const profile = await detectCurrentAccountProfile();
      if (requestId !== lookupRequestRef.current) return;
      setLastQuery({ name: profile.name, tag: profile.tag });
      applyResult(profile);
      setLoading(false);
      toast.dismiss(loadingToastId);
      await loadAccountDetails(profile.name, profile.tag, profile.region, profile, requestId);
    } catch (e) {
      if (requestId !== lookupRequestRef.current) return;
      setError(parseInvokeError(e));
      setResult(null);
      setLoading(false);
      toast.dismiss(loadingToastId);
    }
  };

  const clear = () => {
    setResult(null);
    setError(null);
    setLastQuery(null);
    setRiotId('');
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const isRateLimited = isRateLimitedError(error);

  return (
    <div className = "tools-stack" data-tauri-drag-region>
      <ToolsPanel>
        <input
          type        = "text"
          className   = "tools-input"
          placeholder = "Name#Tag"
          value       = {riotId}
          onChange    = {(e) => setRiotId(e.target.value)}
          onKeyDown   = {(e) => e.key === 'Enter' && handleLookup()}
        />
        {error && <ToolsInvokeError error = {error} onOpenSettings = {onOpenSettings} />}
        <div    className = "tools-actions-row" data-tauri-drag-region>
        <button type      = "button" className = "app-btn app-btn-primary app-btn-compact" onClick = {() => handleLookup()} disabled = {loading}>
            {loading ? 'Looking up...' : 'Search'}
          </button>
          <Tooltip content = "Look up whoever's signed in to the Riot Client right now">
          <button  type    = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {handleDetect} disabled = {loading}>
              Use my account
            </button>
          </Tooltip>
          {result && (
            <button type = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {clear}>
              Clear
            </button>
          )}
        </div>
        {isRateLimited && lastQuery && (
          <div    className = "tools-actions-row">
          <button type      = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => openUrl(vtlUrl(lastQuery.name, lastQuery.tag))}>
              View on vtl.lol
            </button>
            <button type = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => openUrl(trackerUrl(lastQuery.name, lastQuery.tag))}>
              View on tracker.gg
            </button>
          </div>
        )}

        {history.length > 0 && (
          <div    className = "tools-history" data-tauri-drag-region>
          <div    className = "tools-history-header" data-tauri-drag-region>
          <span   className = "tools-panel-title">Recent searches</span>
          <button type      = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {clearHistory}>
                Clear
              </button>
            </div>
            <div className = "tools-history-chips" data-tauri-drag-region>
              {history.map((entry) => (
                <button
                  key       = {`${entry.name.toLowerCase()}#${entry.tag.toLowerCase()}`}
                  type      = "button"
                  className = "tools-history-chip"
                  disabled  = {loading}
                  onClick   = {() => {
                    const id = `${entry.name}#${entry.tag}`;
                    setRiotId(id);
                    void handleLookup(id);
                  }}
                >
                  {entry.name}#{entry.tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </ToolsPanel>

      {loading && !result && (
        <div      className = "tools-dashboard" data-tauri-drag-region>
        <div      className = "tools-sidebar" data-tauri-drag-region>
        <div      className = "skeleton-section" data-tauri-drag-region>
        <Skeleton height    = {84} />
        <Skeleton height    = {13} width = "60%" />
        <Skeleton height    = {11} width = "40%" />
            </div>
            <div      className = "skeleton-section" data-tauri-drag-region>
            <Skeleton width     = {140} height = {11} />
            <Skeleton height    = {36} />
            <Skeleton height    = {36} />
            </div>
          </div>
          <div      className = "tools-main" data-tauri-drag-region>
          <div      className = "skeleton-section" data-tauri-drag-region>
          <Skeleton width     = {110} height = {11} />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key = {i} height = {40} />
              ))}
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className = "tools-dashboard" data-tauri-drag-region>
        <div className = "tools-sidebar" data-tauri-drag-region>
            <ProfileCard
              result   = {result}
              bookmark = {{
                saved : savedPlayerKeys.has(playerKey(result.name, result.tag)),
                saving: savingPlayerKey === playerKey(result.name, result.tag),
                onSave: () => void savePlayer(lookupToSavePayload(result)),
              }}
            />
            {result.gamesPlayed > 0 ? (
              <PerformanceCard result = {result} />
            ) : detailsLoading ? (
              <div      className = "skeleton-section" data-tauri-drag-region>
              <Skeleton width     = {110} height = {11} />
              <Skeleton height    = {36} />
              <Skeleton height    = {36} />
              </div>
            ) : null}
            <SeasonStatsCard seasons = {result.seasons} loading = {detailsLoading} />
          </div>
          <div className = "tools-main" data-tauri-drag-region>
            <RecentMatches
              matches      = {result.recentMatches}
              page         = {matchPage}
              onPageChange = {setMatchPage}
              loading      = {detailsLoading}
            />
          </div>
        </div>
      )}

      {!loading && !result && !error && (
        <ToolsEmpty title = "No lookup yet" hint = "Search a Riot ID above, or use your signed-in account to get started." />
      )}
    </div>
  );
}

function MatchTool({
  section,
  onSectionChange,
  onOpenSettings,
  onLookup,
}: {
  section         : ToolsMatchSection;
  onSectionChange : (section: ToolsMatchSection) => void;
  onOpenSettings ?: () => void;
  onLookup        : (riotId: string) => void;
}) {
  const liveMatch       = useLiveMatchSnapshot();
  const valorantVersion = useValorantVersion();

  return (
    <div                   className = "tools-stack" data-tauri-drag-region>
    <div                   className = "tools-match-toolbar" data-tauri-drag-region>
    <div                   className = "tools-match-meta drag-surface" data-tauri-drag-region>
    <LiveMatchPills        snapshot  = {liveMatch.snapshot} error = {liveMatch.error} />
    <ValorantVersionInline status    = {valorantVersion.status} />
        </div>
        <ToolsSubsectionBar sections = {MATCH_SECTIONS} active = {section} onChange = {onSectionChange} />
      </div>
      {section === 'Lobby' ? (
        <MatchLobbyTool onOpenSettings = {onOpenSettings} />
      ) : (
        <SavedPlayersTool onLookup = {onLookup} onOpenLobby = {() => onSectionChange('Lobby')} />
      )}
    </div>
  );
}

function MatchLobbyTool({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [loading, setLoading]                            = useState(false);
  const [ranksLoading, setRanksLoading]                  = useState(false);
  const [error, setError]                                = useState<UserFacingError | null>(null);
  const [result, setResult]                              = useState<MatchInfo | null>(() => loadSession<MatchInfo>(MATCH_INFO_STATE_KEY));
  const [lookupTarget, setLookupTarget]                  = useState<{ name: string; tag: string } | null>(null);
  const { savedPlayerKeys, savingPlayerKey, savePlayer } = useSavedPlayerBookmarks();
  const fetchRequestRef                                  = useRef(0);

  useEffect(() => {
    const size = result || loading ? TOOLS_LOOKUP_WINDOW_SIZE : BASE_WINDOW_SIZE;
    tweenWindowSize(size.width, size.height);
  }, [result, loading]);

  useEffect(() => {
    return () => {
      tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height);
    };
  }, []);

  useEffect(() => {
    saveSession<MatchInfo>(MATCH_INFO_STATE_KEY, result);
  }, [result]);

  const handleFetch = async () => {
    const requestId = ++fetchRequestRef.current;
    setLoading(true);
    setRanksLoading(false);
    setError(null);
    try {
      const roster = await fetchMatchInfo('roster');
      if (requestId !== fetchRequestRef.current) return;
      setResult(roster);
      setLoading(false);
      setRanksLoading(true);
      try {
        const ranks = await fetchMatchInfo('ranks');
        if (requestId !== fetchRequestRef.current) return;
        setResult(ranks);
      } catch (e) {
        if (requestId !== fetchRequestRef.current) return;
        toast.warning(toastFromError(e, { title: "Couldn't load ranks", icon: 'warning' }));
      } finally {
        if (requestId === fetchRequestRef.current) setRanksLoading(false);
      }
    } catch (e) {
      if (requestId !== fetchRequestRef.current) return;
      setError(parseInvokeError(e));
      setResult(null);
      setLoading(false);
    }
  };

  const allies  = result?.players.filter((p) => p.ally) ?? [];
  const enemies = result?.players.filter((p) => !p.ally) ?? [];

  return (
    <div        className = "tools-stack" data-tauri-drag-region>
    <ToolsPanel title     = "Lobby" hint = "View player ranks and agents during agent select or mid-game.">
        {error && <ToolsInvokeError error = {error} onOpenSettings = {onOpenSettings} />}
        <div    className = "tools-actions-row" data-tauri-drag-region>
        <button type      = "button" className = "app-btn app-btn-primary app-btn-compact" onClick = {handleFetch} disabled = {loading}>
            {loading ? 'Fetching...' : 'Fetch match info'}
          </button>
          {result && (
            <button type = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => setResult(null)}>
              Clear
            </button>
          )}
        </div>
      </ToolsPanel>

      {loading && !result && (
        <div      className = "tools-dashboard" data-tauri-drag-region>
        <div      className = "tools-sidebar" data-tauri-drag-region>
        <div      className = "skeleton-section" data-tauri-drag-region>
        <Skeleton width     = {110} height = {11} />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key = {i} height = {36} />
              ))}
            </div>
          </div>
          <div      className = "tools-main" data-tauri-drag-region>
          <div      className = "skeleton-section" data-tauri-drag-region>
          <Skeleton width     = {110} height = {11} />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key = {i} height = {36} />
              ))}
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className = "tools-dashboard" data-tauri-drag-region>
        <div className = "tools-sidebar" data-tauri-drag-region>
            <MatchTeamCard
              title           = "Your team"
              players         = {allies}
              ranksLoading    = {ranksLoading}
              savedPlayerKeys = {savedPlayerKeys}
              savingPlayerKey = {savingPlayerKey}
              onSavePlayer    = {(player) => void savePlayer(player)}
              onSelectPlayer  = {(name, tag) => setLookupTarget({ name, tag })}
            />
          </div>
          <div className = "tools-main" data-tauri-drag-region>
            {enemies.length > 0 ? (
              <MatchTeamCard
                title           = "Enemy team"
                players         = {enemies}
                ranksLoading    = {ranksLoading}
                savedPlayerKeys = {savedPlayerKeys}
                savingPlayerKey = {savingPlayerKey}
                onSavePlayer    = {(player) => void savePlayer(player)}
                onSelectPlayer  = {(name, tag) => setLookupTarget({ name, tag })}
              />
            ) : (
              !result.inGame && (
                <ToolsEmpty
                  title = "Enemy team not ready"
                  hint  = "Still in agent select. Enemy players appear once the match starts."
                />
              )
            )}
          </div>
        </div>
      )}

      {!loading && !result && !error && (
        <ToolsEmpty title = "No match found" hint = "Fetch match info while you're in agent select or a live game." />
      )}

      <AnimatePresence>
        {lookupTarget && (
          <PlayerLookupOverlay
            name           = {lookupTarget.name}
            tag            = {lookupTarget.tag}
            onClose        = {() => setLookupTarget(null)}
            onOpenSettings = {onOpenSettings}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MonitorTool({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { config, checking, error, lastMatch, lastCheckedAt } = useMonitorStore();
  const [savedAccounts, setSavedAccounts]                     = useState<Account[]>([]);
  const [savedPlayers, setSavedPlayers]                       = useState<SavedPlayer[]>([]);
  const [detecting, setDetecting]                             = useState(false);
  const [detectError, setDetectError]                         = useState<UserFacingError | null>(null);

  useEffect(() => {
    listAccounts()
      .then(setSavedAccounts)
      .catch((e) => {
        logSilentFailure('tools.accounts', e);
        setSavedAccounts([]);
      });
    listSavedPlayers()
      .then(setSavedPlayers)
      .catch((e) => {
        logSilentFailure('tools.savedPlayers', e);
        setSavedPlayers([]);
      });
  }, []);

  const runCheck  = () => monitor.runCheck();
  const setConfig = (next: Partial<MonitorConfig>) => monitor.setConfig(next);

  const handleDetect = async () => {
    setDetecting(true);
    setDetectError(null);
    try {
      const profile = await detectCurrentAccountProfile();
      monitor.setRiotId(`${profile.name}#${profile.tag}`);
    } catch (e) {
      setDetectError(parseInvokeError(e));
    } finally {
      setDetecting(false);
    }
  };

  const displayError  = detectError ?? error;
  const isRateLimited = isRateLimitedError(displayError);

  const savedRiotOptions: DropdownOption[] = [
    ...savedAccounts.map((account) => ({ value: account.label, label: account.label })),
    ...savedPlayers.map((player) => ({
      value: `${player.name}#${player.tag}`,
      label: `${player.name}#${player.tag}`,
    })),
  ];

  return (
    <div className = "tools-stack" data-tauri-drag-region>
      <ToolsPanel>
        <div className = "monitor-interval-row" data-tauri-drag-region>
          <span>Alert when</span>
          <Dropdown
            className = "monitor-metric-dropdown"
            value     = {config.metric}
            options   = {MONITOR_METRIC_OPTIONS}
            onChange  = {(metric) => setConfig({ ...config, metric: metric as MonitorMetric })}
          />
          <span>is above</span>
          <input
            type      = "number"
            min       = {0}
            className = "tools-input monitor-interval-input"
            value     = {config.threshold}
            onChange  = {(e) => setConfig({ ...config, threshold: Math.max(0, Number(e.target.value) || 0) })}
          />
          <span>{MONITOR_METRIC_SUFFIX[config.metric]}</span>
        </div>

        {savedRiotOptions.length > 0 && (
          <Dropdown
            value       = ""
            placeholder = "Pick a saved account or player..."
            options     = {savedRiotOptions}
            onChange    = {(riotId) => monitor.pickSavedAccount(riotId)}
          />
        )}

        <input
          type        = "text"
          className   = "tools-input"
          placeholder = "Or type any Riot ID manually (Name#Tag)"
          value       = {config.riotId}
          onChange    = {(e) => monitor.setRiotId(e.target.value)}
          onKeyDown   = {(e) => e.key === 'Enter' && void runCheck()}
        />

        <div    className = "tools-actions-row" data-tauri-drag-region>
        <button type      = "button" className = "app-btn app-btn-primary app-btn-compact" onClick = {() => void runCheck()} disabled = {checking || detecting || isRateLimited}>
            {checking ? 'Checking...' : 'Check now'}
          </button>
          <Tooltip content = "Fill with whoever's signed in to the Riot Client right now">
          <button  type    = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => void handleDetect()} disabled = {checking || detecting}>
              Use my account
            </button>
          </Tooltip>
        </div>

        <label className = "settings-checkbox-row" htmlFor = "monitor-auto-check">
          <input
            id        = "monitor-auto-check"
            type      = "checkbox"
            className = "settings-checkbox"
            checked   = {config.autoCheckEnabled}
            onChange  = {() => setConfig({ ...config, autoCheckEnabled: !config.autoCheckEnabled })}
          />
          <span>Auto-check while this app is open</span>
        </label>

        {config.autoCheckEnabled && (
          <div className = "settings-slider-label monitor-interval-row" data-tauri-drag-region>
            <span>Check every</span>
            <input
              type      = "number"
              min       = {1}
              className = "tools-input monitor-interval-input"
              value     = {config.intervalValue}
              onChange  = {(e) => setConfig({ ...config, intervalValue: Math.max(1, Number(e.target.value) || 1) })}
            />
            <Dropdown
              className = "monitor-interval-unit"
              value     = {config.intervalUnit}
              options   = {INTERVAL_UNIT_OPTIONS}
              onChange  = {(unit) => setConfig({ ...config, intervalUnit: unit as IntervalUnit })}
            />
          </div>
        )}

        {displayError && <ToolsInvokeError error = {displayError} onOpenSettings = {onOpenSettings} />}

        {lastCheckedAt && lastMatch && (
          <div className = "monitor-last-check" data-tauri-drag-region>
            {lastMatch.mapIconUrl ? (
              <div className = "monitor-map-banner" style = {{ backgroundImage: `url(${lastMatch.mapIconUrl})` }} data-tauri-drag-region>
              <div className = "monitor-map-banner-text">
                  {lastMatch.map} | {lastMatch[config.metric]}
                  {MONITOR_METRIC_SUFFIX[config.metric]} {monitorMetricLabel(config.metric)}
                </div>
              </div>
            ) : (
              <div className = "tools-match-map-name">
                {lastMatch.map} | {lastMatch[config.metric]}
                {MONITOR_METRIC_SUFFIX[config.metric]} {monitorMetricLabel(config.metric)}
              </div>
            )}
            <div className = "tools-result-meta">Last checked {lastCheckedAt.toLocaleTimeString()}</div>
          </div>
        )}
        {lastCheckedAt && !lastMatch && <p className="tools-result-meta">Last checked {lastCheckedAt.toLocaleTimeString()}</p>}
      </ToolsPanel>
    </div>
  );
}

function formatMatchRank(player: Pick<MatchPlayer, 'rank' | 'rr'>): string {
  if (!player.rank) return 'Unranked';
  return player.rr !== null ? `${player.rank} · ${player.rr} RR` : player.rank;
}

function MatchTeamCard({
  title,
  players,
  ranksLoading = false,
  savedPlayerKeys,
  savingPlayerKey,
  onSavePlayer,
  onSelectPlayer,
}: {
  title           : string;
  players         : MatchInfo['players'];
  ranksLoading   ?: boolean;
  savedPlayerKeys : Set<string>;
  savingPlayerKey : string | null;
  onSavePlayer    : (player: MatchPlayer) => void;
  onSelectPlayer  : (name: string, tag: string) => void;
}) {
  if (players.length === 0) return null;
  const side = players.find((p) => p.teamSide)?.teamSide;

  return (
    <section className = "surface-card tools-data-card tools-matches-section" data-tauri-drag-region>
    <div     className = "tools-matches-header" data-tauri-drag-region>
    <span    className = "tools-panel-title">
          {title}
          {side ? ` | ${side}` : ''}
        </span>
      </div>
      <div className = "tools-matches-list" data-tauri-drag-region>
        {players.map((player, index) => {
          const key      = playerKey(player.name, player.tag);
          const isSaved  = savedPlayerKeys.has(key);
          const isSaving = savingPlayerKey === key;

          return (
            <div key = {`${player.name}#${player.tag}-${index}`} className = "tools-match-line-row">
              <button
                type       = "button"
                className  = "tools-match-line"
                aria-label = {`Look up ${player.name}#${player.tag}`}
                onClick    = {() => onSelectPlayer(player.name, player.tag)}
              >
                {player.agentIconUrl && <img src={player.agentIconUrl} alt="" className="tools-agent-icon" />}
                <div  className = "tools-match-map">
                <div  className = "tools-match-player-head">
                <span className = "tools-match-map-name">
                      {player.name}#{player.tag}
                    </span>
                    {ranksLoading && player.rank == null ? (
                      <span className = "tools-match-rank-loading">...</span>
                    ) : (
                      <Tooltip content   = {formatMatchRank(player)}>
                      <span    className = "tools-match-rank-icon-wrap" aria-label = {formatMatchRank(player)}>
                          {player.rankIconUrl ? (
                            <img src = {player.rankIconUrl} alt = "" className = "tools-rank-icon tools-match-rank-icon" aria-hidden = "true" />
                          ) : (
                            <span className = "tools-match-rank-fallback" aria-hidden = "true">
                              ?
                            </span>
                          )}
                        </span>
                      </Tooltip>
                    )}
                  </div>
                  <span className = "tools-result-meta">{player.agent ?? 'Unknown agent'}</span>
                </div>
              </button>
              <Tooltip content = {isSaved ? 'Saved to your collection' : 'Save to your collection'}>
                <button
                  type       = "button"
                  className  = {`tools-save-player-btn${isSaved ? ' saved' : ''}`}
                  aria-label = {isSaved ? 'Player saved' : 'Save player'}
                  disabled   = {isSaved || isSaving}
                  onClick    = {() => onSavePlayer(player)}
                >
                  <BookmarkIcon filled = {isSaved} />
                </button>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox = "0 0 24 24" fill = {filled ? 'currentColor' : 'none'} aria-hidden = "true">
      <path
        d              = "M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v14.1a.8.8 0 0 1-1.22.68L12 17.8l-5.28 2.98A.8.8 0 0 1 5.5 20.1V6A1.5 1.5 0 0 1 7 4.5Z"
        stroke         = "currentColor"
        strokeWidth    = "1.6"
        strokeLinejoin = "round"
      />
    </svg>
  );
}

function PlayerLookupOverlay({
  name,
  tag,
  onClose,
  onOpenSettings,
}: {
  name           : string;
  tag            : string;
  onClose        : () => void;
  onOpenSettings?: () => void;
}) {
  const [loading, setLoading]                                                         = useState(true);
  const [error, setError]                                                             = useState<UserFacingError | null>(null);
  const [result, setResult]                                                           = useState<AccountLookup | null>(null);
  const [matchPage, setMatchPage]                                                     = useState(0);
  const { savedPlayerKeys, savingPlayerKey, savePlayer, syncSavedPlayerIfBookmarked } = useSavedPlayerBookmarks();
  const lastSyncedFingerprintRef                                                      = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    lookupAccount(name, tag)
      .then(async (account) => {
        if (cancelled) return;
        setResult(account);
        const payload     = lookupToSavePayload(account);
        const fingerprint = savePayloadFingerprint(payload);
        if (lastSyncedFingerprintRef.current !== fingerprint) {
          lastSyncedFingerprintRef.current = fingerprint;
          await syncSavedPlayerIfBookmarked(payload);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(parseInvokeError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [name, tag, syncSavedPlayerIfBookmarked]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className  = "dialog-backdrop lookup-overlay-backdrop"
      onClick    = {onClose}
      initial    = {{ opacity: 0 }}
      animate    = {{ opacity: 1 }}
      exit       = {{ opacity: 0 }}
      transition = {{ duration: 0.16 }}
    >
      <motion.div
        className  = "dialog lookup-overlay-dialog"
        role       = "dialog"
        aria-modal = "true"
        onClick    = {(e) => e.stopPropagation()}
        initial    = {{ opacity: 0, scale: 0.96, y: 8 }}
        animate    = {{ opacity: 1, scale: 1, y: 0 }}
        exit       = {{ opacity: 0, scale: 0.96, y: 8 }}
        transition = {{ duration: 0.18, ease: [0.2, 0.9, 0.3, 1.2] }}
      >
        <div  className = "lookup-overlay-header">
        <span className = "tools-panel-title">
            {name}#{tag}
          </span>
          <button type = "button" className = "app-btn app-btn-secondary app-btn-compact lookup-overlay-close" onClick = {onClose} aria-label = "Close">
            ×
          </button>
        </div>

        {loading && (
          <div      className = "skeleton-section">
          <Skeleton height    = {84} />
          <Skeleton height    = {13} width = "60%" />
          <Skeleton height    = {11} width = "40%" />
          </div>
        )}

        {error && <ToolsInvokeError error = {error} onOpenSettings = {onOpenSettings} />}

        {result && (
          <div className = "tools-dashboard">
          <div className = "tools-sidebar">
              <ProfileCard
                result   = {result}
                bookmark = {{
                  saved : savedPlayerKeys.has(playerKey(result.name, result.tag)),
                  saving: savingPlayerKey === playerKey(result.name, result.tag),
                  onSave: () => void savePlayer(lookupToSavePayload(result)),
                }}
              />
              {result.gamesPlayed > 0 && <PerformanceCard result={result} />}
              <SeasonStatsCard seasons = {result.seasons} />
            </div>
            <div           className = "tools-main">
            <RecentMatches matches   = {result.recentMatches} page = {matchPage} onPageChange = {setMatchPage} />
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ProfileCard({
  result,
  bookmark,
}: {
  result   : AccountLookup;
  bookmark?: { saved: boolean; saving: boolean; onSave: () => void };
}) {
  return (
    <section className = "surface-card tools-data-card tools-profile-card" data-tauri-drag-region>
    <div     className = "tools-result-header" data-tauri-drag-region>
    <img     src       = {result.cardUrl} alt = "" className = "tools-card-art" />
    <div     className = "tools-profile-info" data-tauri-drag-region>
    <div     className = "tools-profile-top-row" data-tauri-drag-region>
    <div     className = "tools-result-name">
              {result.name}#{result.tag}
            </div>
            <div className = "tools-result-meta">Updated {result.lastUpdate}</div>
          </div>
          <div className = "tools-result-meta">
            {result.region.toUpperCase()} | Level {result.accountLevel}
          </div>
        </div>
      </div>

      {result.rank && (
        <div className = "tools-rank-row" data-tauri-drag-region>
          {result.rankIconUrl && <img src={result.rankIconUrl} alt="" className="tools-rank-icon" />}
          <div data-tauri-drag-region>
            <div className = "tools-rank-name">
              {result.rank}
              {result.rr !== null ? ` | ${result.rr} RR` : ''}
            </div>
            {result.peakRank && <div className="tools-result-meta">Peak: {result.peakRank}</div>}
          </div>
        </div>
      )}

      <div className = "tools-profile-actions" data-tauri-drag-region>
        {bookmark && (
          <button
            type      = "button"
            className = {`app-btn app-btn-secondary tools-profile-bookmark-btn${bookmark.saved ? ' saved' : ''}`}
            disabled  = {bookmark.saved || bookmark.saving}
            onClick   = {bookmark.onSave}
          >
            <BookmarkIcon filled = {bookmark.saved} />
            {bookmark.saving ? 'Saving...' : bookmark.saved ? 'Saved to collection' : 'Bookmark user'}
          </button>
        )}
        <div    className = "tools-actions-row" data-tauri-drag-region>
        <button type      = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => openUrl(vtlUrl(result.name, result.tag))}>
            View on vtl.lol
          </button>
          <button type = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => openUrl(trackerUrl(result.name, result.tag))}>
            View on tracker.gg
          </button>
        </div>
      </div>
    </section>
  );
}

function PerformanceCard({ result }: { result: AccountLookup }) {
  return (
    <section className = "surface-card tools-data-card" data-tauri-drag-region>
    <span    className = "tools-panel-title">Performance (last {result.gamesPlayed} matches)</span>

      <div  className = "tools-overview" data-tauri-drag-region>
      <Stat label     = "Games" value    = {result.gamesPlayed} />
      <Stat label     = "Win Rate" value = {`${result.winRate}%`} />
      <Stat label     = "KDA" value      = {result.kda.toFixed(2)} />
      <Stat label     = "HS%" value      = {`${result.avgHsPercent}%`} />
      <Stat label     = "Kills" value    = {result.totalKills} />
      <Stat label     = "Deaths" value   = {result.totalDeaths} />
      <Stat label     = "Assists" value  = {result.totalAssists} />
      </div>

      {result.topAgents.length > 0 && (
        <div className = "tools-agents" data-tauri-drag-region>
        <div className = "tools-panel-title">Most played</div>
        <div className = "tools-agents-row" data-tauri-drag-region>
            {result.topAgents.map((agent) => {
              const winRate = agent.games > 0 ? Math.round((agent.wins / agent.games) * 100) : 0;
              const kd      = agent.deaths > 0 ? (agent.kills / agent.deaths).toFixed(2) : agent.kills.toFixed(2);
              return (
                <div key = {agent.agent} className  = "tools-agent-row" data-tauri-drag-region>
                <img src = {agent.agentIconUrl} alt = "" className = "tools-agent-icon" />
                  <div data-tauri-drag-region>
                    <div className = "tools-result-name">{agent.agent}</div>
                    <div className = "tools-result-meta">
                      {agent.games} games | {winRate}% WR | {kd} KD
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function SeasonStatsCard({ seasons, loading = false }: { seasons: SeasonStats[]; loading?: boolean }) {
  const [seasonId, setSeasonId] = useState(seasons[0]?.seasonId ?? '');

  useEffect(() => {
    if (seasons.length === 0) {
      if (seasonId !== '') setSeasonId('');
      return;
    }
    if (!seasons.some((s) => s.seasonId === seasonId)) {
      setSeasonId(seasons[0].seasonId);
    }
  }, [seasons, seasonId]);

  const season = seasons.find((s) => s.seasonId === seasonId) ?? seasons[0] ?? null;

  return (
    <section className = "surface-card tools-data-card" data-tauri-drag-region>
    <span    className = "tools-panel-title">Lookup by act</span>

      {loading && seasons.length === 0 ? (
        <div      className = "skeleton-section" data-tauri-drag-region>
        <Skeleton height    = {36} />
        <Skeleton height    = {72} />
        </div>
      ) : seasons.length === 0 ? (
        <p className = "settings-error">This account has not been ranked before.</p>
      ) : (
        <>
          <Dropdown value = {seasonId} options = {seasons.map((s) => ({ value: s.seasonId, label: s.seasonLabel }))} onChange = {setSeasonId} />

          {season && (
            <div  className = "tools-overview" data-tauri-drag-region>
            <Stat label     = "Rank" value     = {season.rank} />
            <Stat label     = "Win Rate" value = {`${season.winRate}%`} />
            <Stat label     = "Games" value    = {season.games} />
            <Stat label     = "Wins" value     = {season.wins} />
              {season.leaderboardPlacement !== null && <Stat label="Leaderboard" value={`#${season.leaderboardPlacement}`} />}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className = "tools-stat" data-tauri-drag-region>
    <div className = "tools-stat-value" data-tauri-drag-region>
        {value}
      </div>
      <div className = "tools-stat-label" data-tauri-drag-region>
        {label}
      </div>
    </div>
  );
}

function RecentMatches({
  matches,
  page,
  onPageChange,
  loading = false,
}: {
  matches      : AccountLookup['recentMatches'];
  page         : number;
  onPageChange : (page: number) => void;
  loading     ?: boolean;
}) {
  if (loading && matches.length === 0) {
    return (
      <section className = "surface-card tools-data-card tools-matches-section" data-tauri-drag-region>
      <span    className = "tools-panel-title">Recent matches</span>
      <div     className = "skeleton-section" data-tauri-drag-region>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key = {i} height = {40} />
          ))}
        </div>
      </section>
    );
  }

  if (matches.length === 0) return null;

  const totalPages  = Math.ceil(matches.length / MATCHES_PER_PAGE);
  const clampedPage = Math.min(page, totalPages - 1);
  const visible     = matches.slice(clampedPage * MATCHES_PER_PAGE, clampedPage * MATCHES_PER_PAGE + MATCHES_PER_PAGE);

  return (
    <section className = "surface-card tools-data-card tools-matches-section" data-tauri-drag-region>
    <div     className = "tools-matches-header" data-tauri-drag-region>
    <span    className = "tools-panel-title">Recent matches</span>
        {totalPages > 1 && (
          <div    className = "tools-matches-pager" data-tauri-drag-region>
          <button type      = "button" className = "app-btn app-btn-secondary app-btn-compact" disabled = {clampedPage === 0} onClick = {() => onPageChange(clampedPage - 1)}>
              Prev
            </button>
            <span className = "tools-result-meta">
              {clampedPage + 1} / {totalPages}
            </span>
            <button
              type      = "button"
              className = "app-btn app-btn-secondary app-btn-compact"
              disabled  = {clampedPage === totalPages - 1}
              onClick   = {() => onPageChange(clampedPage + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
      <div className = "tools-matches-list" data-tauri-drag-region>
        {visible.map((match, index) => (
          <div  key       = {clampedPage * MATCHES_PER_PAGE + index} className = {`tools-match-line tools-match-${match.result.toLowerCase()}`} data-tauri-drag-region>
          <img  src       = {match.agentIconUrl} alt                           = "" className = "tools-agent-icon" />
          <div  className = "tools-match-map" data-tauri-drag-region>
          <span className = "tools-match-map-name">{match.map}</span>
          <span className = "tools-result-meta">
                {match.mode} | {matchDateFormatter.format(new Date(match.date))}
              </span>
            </div>
            <span className = "tools-match-kda">{`${match.kills}/${match.deaths}/${match.assists}`}</span>
            <span className = "tools-match-hs">{match.hsPercent}% HS</span>
            <span className = "tools-match-score">
              {match.teamScore}-{match.enemyScore}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
