import { openUrl } from '@tauri-apps/plugin-opener';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { fetchMatchInfo, lookupAccount } from '../api/tools';
import { useMouseGlow } from '../hooks/useMouseGlow';
import type { AccountLookup, MatchInfo } from '../types';
import { BASE_WINDOW_SIZE, tweenWindowSize } from '../utils/windowSize';
import { Skeleton } from './Skeleton';

const EXPANDED_WINDOW_SIZE = { width: 960, height: 760 };
const HENRIK_DASHBOARD_URL = 'https://api.henrikdev.xyz/dashboard/';

const TOOL_CATEGORIES = ['Lookup', 'Match Info'] as const;
type ToolCategory = (typeof TOOL_CATEGORIES)[number];

const matchDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const HISTORY_KEY = 'tools-lookup-history';
const LOOKUP_STATE_KEY = 'tools-lookup-last';
const MATCH_INFO_STATE_KEY = 'tools-matchinfo-last';
const MAX_HISTORY = 12;
const MATCHES_PER_PAGE = 10;

interface HistoryEntry {
  name: string;
  tag: string;
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
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
    return raw ? JSON.parse(raw) : null;
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

function ErrorMessage({ error, onOpenSettings }: { error: string; onOpenSettings?: () => void }) {
  if (error.includes('henrikdev api key')) {
    return (
      <p className="settings-error">
        Head to{' '}
        <button type="button" className="inline-link" onClick={() => openUrl(HENRIK_DASHBOARD_URL)}>
          https://api.henrikdev.xyz/dashboard/
        </button>{' '}
        and log in with Discord, go to "API Keys", then "Generate New Key". Then paste it into{' '}
        <button type="button" className="inline-link" onClick={onOpenSettings}>
          Settings
        </button>
        .
      </p>
    );
  }
  return <p className="settings-error">{error}</p>;
}

interface Props {
  initialQuery?: string | null;
  onInitialQueryConsumed?: () => void;
  onOpenSettings?: () => void;
}

export function ToolsPage({ initialQuery, onInitialQueryConsumed, onOpenSettings }: Props) {
  const glowRef = useMouseGlow<HTMLElement>();
  const [category, setCategory] = useState<ToolCategory>('Lookup');

  return (
    <main className="settings-page" data-tauri-drag-region ref={glowRef}>
      <div className="tools-content" data-tauri-drag-region>
        <div className="settings-header" data-tauri-drag-region>
          <h2>Tools</h2>
        </div>

        <div className="tools-tabs" data-tauri-drag-region>
          {TOOL_CATEGORIES.map((id) => (
            <button key={id} type="button" className={`tools-tab${id === category ? ' active' : ''}`} onClick={() => setCategory(id)}>
              {id}
            </button>
          ))}
        </div>

        {category === 'Lookup' && (
          <LookupTool initialQuery={initialQuery} onInitialQueryConsumed={onInitialQueryConsumed} onOpenSettings={onOpenSettings} />
        )}
        {category === 'Match Info' && <MatchInfoTool onOpenSettings={onOpenSettings} />}
      </div>
    </main>
  );
}

interface StoredLookupState {
  riotId: string;
  result: AccountLookup | null;
  lastQuery: { name: string; tag: string } | null;
}

function LookupTool({ initialQuery, onInitialQueryConsumed, onOpenSettings }: Props) {
  const [riotId, setRiotId] = useState(() => initialQuery ?? loadSession<StoredLookupState>(LOOKUP_STATE_KEY)?.riotId ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccountLookup | null>(() =>
    initialQuery ? null : loadSession<StoredLookupState>(LOOKUP_STATE_KEY)?.result ?? null,
  );
  const [lastQuery, setLastQuery] = useState<{ name: string; tag: string } | null>(() =>
    initialQuery ? null : loadSession<StoredLookupState>(LOOKUP_STATE_KEY)?.lastQuery ?? null,
  );
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [matchPage, setMatchPage] = useState(0);

  useEffect(() => {
    const size = result || loading ? EXPANDED_WINDOW_SIZE : BASE_WINDOW_SIZE;
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
    onInitialQueryConsumed?.();
    void handleLookup(initialQuery);
  }, []);

  const handleLookup = async (queryOverride?: string) => {
    const [name, tag] = (queryOverride ?? riotId).split('#').map((part) => part.trim());
    if (!name || !tag) {
      setError('Riot ID is empty (Name#Tag)');
      return;
    }

    setLoading(true);
    setError(null);
    setLastQuery({ name, tag });
    try {
      const account = await lookupAccount(name, tag);
      setResult(account);
      setMatchPage(0);
      setHistory((prev) => {
        const next = [
          { name: account.name, tag: account.tag },
          ...prev.filter((h) => !(h.name.toLowerCase() === account.name.toLowerCase() && h.tag.toLowerCase() === account.tag.toLowerCase())),
        ].slice(0, MAX_HISTORY);
        saveHistory(next);
        return next;
      });
    } catch (e) {
      setError(String(e));
      setResult(null);
    } finally {
      setLoading(false);
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

  const isRateLimited = error !== null && error.toLowerCase().includes('rate limit');

  return (
    <>
      <div className="settings-section" data-tauri-drag-region>
        <span className="settings-section-label">Account lookup</span>
        <input
          type="text"
          className="tools-input"
          placeholder="Name#Tag"
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
        />
        {error && <ErrorMessage error={error} onOpenSettings={onOpenSettings} />}
        <div className="settings-path-actions" data-tauri-drag-region>
          <button type="button" className="settings-button" onClick={() => handleLookup()} disabled={loading}>
            {loading ? 'Looking up…' : 'Search'}
          </button>
          {result && (
            <button type="button" className="settings-button" onClick={clear}>
              Clear
            </button>
          )}
        </div>
        {isRateLimited && lastQuery && (
          <div className="settings-path-actions">
            <button type="button" className="settings-button" onClick={() => openUrl(vtlUrl(lastQuery.name, lastQuery.tag))}>
              View on vtl.lol
            </button>
            <button type="button" className="settings-button" onClick={() => openUrl(trackerUrl(lastQuery.name, lastQuery.tag))}>
              View on tracker.gg
            </button>
          </div>
        )}

        {history.length > 0 && (
          <div className="tools-history" data-tauri-drag-region>
            <div className="tools-history-header" data-tauri-drag-region>
              <span className="settings-section-label">Recent searches</span>
              <button type="button" className="tools-history-clear" onClick={clearHistory}>
                Clear history
              </button>
            </div>
            <div className="tools-history-chips" data-tauri-drag-region>
              {history.map((entry) => (
                <button
                  key={`${entry.name.toLowerCase()}#${entry.tag.toLowerCase()}`}
                  type="button"
                  className="tools-history-chip"
                  disabled={loading}
                  onClick={() => {
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
      </div>

      {loading && !result && (
        <div className="tools-dashboard" data-tauri-drag-region>
          <div className="tools-sidebar" data-tauri-drag-region>
            <div className="skeleton-section" data-tauri-drag-region>
              <Skeleton height={84} />
              <Skeleton height={13} width="60%" />
              <Skeleton height={11} width="40%" />
            </div>
            <div className="skeleton-section" data-tauri-drag-region>
              <Skeleton width={140} height={11} />
              <Skeleton height={36} />
              <Skeleton height={36} />
            </div>
          </div>
          <div className="tools-main" data-tauri-drag-region>
            <div className="skeleton-section" data-tauri-drag-region>
              <Skeleton width={110} height={11} />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={40} />
              ))}
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="tools-dashboard" data-tauri-drag-region>
          <div className="tools-sidebar" data-tauri-drag-region>
            <ProfileCard result={result} />
            {result.gamesPlayed > 0 && <PerformanceCard result={result} />}
          </div>
          <div className="tools-main" data-tauri-drag-region>
            <RecentMatches matches={result.recentMatches} page={matchPage} onPageChange={setMatchPage} />
          </div>
        </div>
      )}
    </>
  );
}

function MatchInfoTool({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchInfo | null>(() => loadSession<MatchInfo>(MATCH_INFO_STATE_KEY));
  const [lookupTarget, setLookupTarget] = useState<{ name: string; tag: string } | null>(null);

  useEffect(() => {
    const size = result || loading ? EXPANDED_WINDOW_SIZE : BASE_WINDOW_SIZE;
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
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchMatchInfo());
    } catch (e) {
      setError(String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const allies = result?.players.filter((p) => p.ally) ?? [];
  const enemies = result?.players.filter((p) => !p.ally) ?? [];

  return (
    <>
      <div className="settings-section" data-tauri-drag-region>
        <span className="settings-section-label">Live match</span>
        <p className="tools-result-meta">Shows the names, ranks, and players of everyone agent select or live match.</p>
        {error && <ErrorMessage error={error} onOpenSettings={onOpenSettings} />}
        <div className="settings-path-actions" data-tauri-drag-region>
          <button type="button" className="settings-button" onClick={handleFetch} disabled={loading}>
            {loading ? 'Fetching…' : 'Fetch match info'}
          </button>
          {result && (
            <button type="button" className="settings-button" onClick={() => setResult(null)}>
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && !result && (
        <div className="tools-dashboard" data-tauri-drag-region>
          <div className="tools-sidebar" data-tauri-drag-region>
            <div className="skeleton-section" data-tauri-drag-region>
              <Skeleton width={110} height={11} />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={36} />
              ))}
            </div>
          </div>
          <div className="tools-main" data-tauri-drag-region>
            <div className="skeleton-section" data-tauri-drag-region>
              <Skeleton width={110} height={11} />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={36} />
              ))}
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="tools-dashboard" data-tauri-drag-region>
          <div className="tools-sidebar" data-tauri-drag-region>
            <MatchTeamCard title="Your team" players={allies} onSelectPlayer={(name, tag) => setLookupTarget({ name, tag })} />
          </div>
          <div className="tools-main" data-tauri-drag-region>
            {enemies.length > 0 ? (
              <MatchTeamCard title="Enemy team" players={enemies} onSelectPlayer={(name, tag) => setLookupTarget({ name, tag })} />
            ) : (
              !result.inGame && (
                <p className="tools-result-meta">Still in agent select. Enemy team isn't available until the match starts.</p>
              )
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {lookupTarget && (
          <PlayerLookupOverlay
            name={lookupTarget.name}
            tag={lookupTarget.tag}
            onClose={() => setLookupTarget(null)}
            onOpenSettings={onOpenSettings}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function MatchTeamCard({
  title,
  players,
  onSelectPlayer,
}: {
  title: string;
  players: MatchInfo['players'];
  onSelectPlayer: (name: string, tag: string) => void;
}) {
  if (players.length === 0) return null;
  const side = players.find((p) => p.teamSide)?.teamSide;

  return (
    <div className="settings-section tools-matches-section" data-tauri-drag-region>
      <div className="tools-matches-header" data-tauri-drag-region>
        <span className="settings-section-label">
          {title}
          {side ? ` · ${side}` : ''}
        </span>
      </div>
      <div className="tools-matches-list" data-tauri-drag-region>
        {players.map((player, index) => (
          <button
            key={`${player.name}#${player.tag}-${index}`}
            type="button"
            className="tools-match-line"
            onClick={() => onSelectPlayer(player.name, player.tag)}
          >
            {player.agentIconUrl && <img src={player.agentIconUrl} alt="" className="tools-agent-icon" />}
            <div className="tools-match-map">
              <span className="tools-match-map-name">
                {player.name}#{player.tag}
              </span>
              <span className="tools-result-meta">{player.agent ?? 'Unknown agent'}</span>
            </div>
            <span className="tools-match-rank tools-result-meta">{player.rank ?? 'Unranked'}{player.rr !== null ? ` · ${player.rr} RR` : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayerLookupOverlay({
  name,
  tag,
  onClose,
  onOpenSettings,
}: {
  name: string;
  tag: string;
  onClose: () => void;
  onOpenSettings?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccountLookup | null>(null);
  const [matchPage, setMatchPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    lookupAccount(name, tag)
      .then((account) => {
        if (!cancelled) setResult(account);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [name, tag]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className="dialog-backdrop lookup-overlay-backdrop"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <motion.div
        className="dialog lookup-overlay-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0.9, 0.3, 1.2] }}
      >
        <div className="lookup-overlay-header">
          <span className="settings-section-label">
            {name}#{tag}
          </span>
          <button type="button" className="lookup-overlay-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {loading && (
          <div className="skeleton-section">
            <Skeleton height={84} />
            <Skeleton height={13} width="60%" />
            <Skeleton height={11} width="40%" />
          </div>
        )}

        {error && <ErrorMessage error={error} onOpenSettings={onOpenSettings} />}

        {result && (
          <div className="tools-dashboard">
            <div className="tools-sidebar">
              <ProfileCard result={result} />
              {result.gamesPlayed > 0 && <PerformanceCard result={result} />}
            </div>
            <div className="tools-main">
              <RecentMatches matches={result.recentMatches} page={matchPage} onPageChange={setMatchPage} />
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ProfileCard({ result }: { result: AccountLookup }) {
  return (
    <div className="settings-section" data-tauri-drag-region>
      <div className="tools-result-header" data-tauri-drag-region>
        <img src={result.cardUrl} alt="" className="tools-card-art" />
        <div className="tools-profile-info" data-tauri-drag-region>
          <div className="tools-profile-top-row" data-tauri-drag-region>
            <div className="tools-result-name">
              {result.name}#{result.tag}
            </div>
            <div className="tools-result-meta">Updated {result.lastUpdate}</div>
          </div>
          <div className="tools-result-meta">
            {result.region.toUpperCase()} · Level {result.accountLevel}
          </div>
        </div>
      </div>

      {result.rank && (
        <div className="tools-rank-row" data-tauri-drag-region>
          {result.rankIconUrl && <img src={result.rankIconUrl} alt="" className="tools-rank-icon" />}
          <div data-tauri-drag-region>
            <div className="tools-rank-name">
              {result.rank}
              {result.rr !== null ? ` · ${result.rr} RR` : ''}
            </div>
            {result.peakRank && <div className="tools-result-meta">Peak: {result.peakRank}</div>}
          </div>
        </div>
      )}

      <div className="settings-path-actions" data-tauri-drag-region>
        <button type="button" className="settings-button" onClick={() => openUrl(vtlUrl(result.name, result.tag))}>
          View on vtl.lol
        </button>
        <button type="button" className="settings-button" onClick={() => openUrl(trackerUrl(result.name, result.tag))}>
          View on tracker.gg
        </button>
      </div>
    </div>
  );
}

function PerformanceCard({ result }: { result: AccountLookup }) {
  return (
    <div className="settings-section" data-tauri-drag-region>
      <span className="settings-section-label">Performance (last {result.gamesPlayed} matches)</span>

      <div className="tools-overview" data-tauri-drag-region>
        <Stat label="Games" value={result.gamesPlayed} />
        <Stat label="Win Rate" value={`${result.winRate}%`} />
        <Stat label="KDA" value={result.kda.toFixed(2)} />
        <Stat label="HS%" value={`${result.avgHsPercent}%`} />
        <Stat label="Kills" value={result.totalKills} />
        <Stat label="Deaths" value={result.totalDeaths} />
        <Stat label="Assists" value={result.totalAssists} />
      </div>

      {result.topAgents.length > 0 && (
        <div className="tools-agents" data-tauri-drag-region>
          <div className="settings-section-label">Most played</div>
          <div className="tools-agents-row" data-tauri-drag-region>
            {result.topAgents.map((agent) => {
              const winRate = agent.games > 0 ? Math.round((agent.wins / agent.games) * 100) : 0;
              const kd = agent.deaths > 0 ? (agent.kills / agent.deaths).toFixed(2) : agent.kills.toFixed(2);
              return (
                <div key={agent.agent} className="tools-agent-row" data-tauri-drag-region>
                  <img src={agent.agentIconUrl} alt="" className="tools-agent-icon" />
                  <div data-tauri-drag-region>
                    <div className="tools-result-name">{agent.agent}</div>
                    <div className="tools-result-meta">
                      {agent.games} games · {winRate}% WR · {kd} KD
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="tools-stat" data-tauri-drag-region>
      <div className="tools-stat-value" data-tauri-drag-region>
        {value}
      </div>
      <div className="tools-stat-label" data-tauri-drag-region>
        {label}
      </div>
    </div>
  );
}

function RecentMatches({
  matches,
  page,
  onPageChange,
}: {
  matches: AccountLookup['recentMatches'];
  page: number;
  onPageChange: (page: number) => void;
}) {
  if (matches.length === 0) return null;

  const totalPages = Math.ceil(matches.length / MATCHES_PER_PAGE);
  const clampedPage = Math.min(page, totalPages - 1);
  const visible = matches.slice(clampedPage * MATCHES_PER_PAGE, clampedPage * MATCHES_PER_PAGE + MATCHES_PER_PAGE);

  return (
    <div className="settings-section tools-matches-section" data-tauri-drag-region>
      <div className="tools-matches-header" data-tauri-drag-region>
        <span className="settings-section-label">Recent matches</span>
        {totalPages > 1 && (
          <div className="tools-matches-pager" data-tauri-drag-region>
            <button type="button" className="tools-history-clear" disabled={clampedPage === 0} onClick={() => onPageChange(clampedPage - 1)}>
              Prev
            </button>
            <span className="tools-result-meta">
              {clampedPage + 1} / {totalPages}
            </span>
            <button
              type="button"
              className="tools-history-clear"
              disabled={clampedPage === totalPages - 1}
              onClick={() => onPageChange(clampedPage + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
      <div className="tools-matches-list" data-tauri-drag-region>
        {visible.map((match, index) => (
          <div key={clampedPage * MATCHES_PER_PAGE + index} className={`tools-match-line tools-match-${match.result.toLowerCase()}`} data-tauri-drag-region>
            <img src={match.agentIconUrl} alt="" className="tools-agent-icon" />
            <div className="tools-match-map" data-tauri-drag-region>
              <span className="tools-match-map-name">{match.map}</span>
              <span className="tools-result-meta">
                {match.mode} · {matchDateFormatter.format(new Date(match.date))}
              </span>
            </div>
            <span className="tools-match-kda">{`${match.kills}/${match.deaths}/${match.assists}`}</span>
            <span className="tools-match-hs">{match.hsPercent}% HS</span>
            <span className="tools-match-score">
              {match.teamScore}-{match.enemyScore}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
