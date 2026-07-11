import { useEffect, useRef, useState } from 'react';

import { listAccounts } from '../api/accounts';
import { listSavedPlayers } from '../api/savedPlayers';
import { detectCurrentAccountProfile, lookupAccount } from '../api/tools';
import { COMPARISON_WINDOW_SIZE } from '../constants/windowSizes';
import type { Account, AccountLookup, SavedPlayer } from '../types';
import { parseRiotId } from '../utils/playerId';
import { EMPTY_RIOT_ID_ERROR, parseInvokeError, type UserFacingError } from '../utils/userError';
import { logSilentFailure } from '../utils/silentError';
import { BASE_WINDOW_SIZE, tweenWindowSize } from '../utils/windowSize';
import { Dropdown, type DropdownOption } from './Dropdown';
import { ToolsInvokeError } from './ErrorDisplay';
import { Skeleton } from './Skeleton';
import { Tooltip } from './Tooltip';
import { ToolsEmpty, ToolsPanel } from './ToolsUi';

interface Side {
  query  : string;
  loading: boolean;
  error  : UserFacingError | null;
  result : AccountLookup | null;
}

const EMPTY_SIDE: Side = { query: '', loading: false, error: null, result: null };

const SIDE_HINT = 'Enter a Riot ID or pick from your saved accounts and players.';

interface ComparisonRow {
  label        : string;
  format       : (account: AccountLookup) => string;
  metric      ?: (account: AccountLookup) => number;
  lowerIsBetter?: boolean;
}

const ROWS: ComparisonRow[] = [
  { label: 'Peak rank', format: (a) => a.peakRank ?? 'Unranked' },
  { label: 'Win rate', format: (a) => `${a.winRate}%`, metric: (a) => a.winRate },
  { label: 'Games played', format: (a) => a.gamesPlayed.toString() },
  { label: 'KDA', format: (a) => a.kda.toFixed(2), metric: (a) => a.kda },
  { label: 'K/D ratio', format: (a) => killDeathRatio(a).toFixed(2), metric: killDeathRatio },
  { label: 'Headshot %', format: (a) => `${a.avgHsPercent}%`, metric: (a) => a.avgHsPercent },
  { label: 'Total kills', format: (a) => a.totalKills.toLocaleString(), metric: (a) => a.totalKills },
  { label: 'Total deaths', format: (a) => a.totalDeaths.toLocaleString(), metric: (a) => a.totalDeaths, lowerIsBetter: true },
  { label: 'Total assists', format: (a) => a.totalAssists.toLocaleString(), metric: (a) => a.totalAssists },
  { label: 'Account level', format: (a) => a.accountLevel.toString(), metric: (a) => a.accountLevel },
];

function killDeathRatio(a: AccountLookup): number {
  return a.totalDeaths > 0 ? a.totalKills / a.totalDeaths : a.totalKills;
}

function rowWinner(row: ComparisonRow, left: AccountLookup, right: AccountLookup): 'left' | 'right' | null {
  if (!row.metric) return null;
  const leftValue = row.metric(left);
  const rightValue = row.metric(right);
  if (leftValue === rightValue) return null;
  const leftHigher = leftValue > rightValue;
  return (row.lowerIsBetter ? !leftHigher : leftHigher) ? 'left' : 'right';
}

function SidePreview({ result }: { result: AccountLookup }) {
  return (
    <div className="comparison-side-preview drag-surface" data-tauri-drag-region>
      <div className="tools-result-header" data-tauri-drag-region>
        <img src={result.cardUrl} alt="" className="tools-card-art" />
        <div className="tools-profile-info" data-tauri-drag-region>
          <div className="tools-result-name">
            {result.name}#{result.tag}
          </div>
          <div className="tools-result-meta">
            {result.region.toUpperCase()} | Level {result.accountLevel}
          </div>
        </div>
      </div>
      {result.rank && (
        <div className="tools-rank-row" data-tauri-drag-region>
          {result.rankIconUrl && <img src={result.rankIconUrl} alt="" className="tools-rank-icon" />}
          <div data-tauri-drag-region>
            <div className="tools-rank-name">
              {result.rank}
              {result.rr !== null ? ` | ${result.rr} RR` : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerHeader({ result }: { result: AccountLookup }) {
  return (
    <div className="comparison-th-player" data-tauri-drag-region>
      <img src={result.cardUrl} alt="" className="tools-card-art" />
      <div data-tauri-drag-region>
        <div className="tools-result-name">
          {result.name}#{result.tag}
        </div>
        <div className="tools-result-meta">{result.region.toUpperCase()} | Level {result.accountLevel}</div>
      </div>
    </div>
  );
}

function RankCell({ result }: { result: AccountLookup }) {
  if (!result.rank) return <span>Unranked</span>;
  return (
    <div className="comparison-cell-icon-row">
      {result.rankIconUrl && <img src={result.rankIconUrl} alt="" className="tools-rank-icon" />}
      <span>
        {result.rank}
        {result.rr !== null ? ` | ${result.rr} RR` : ''}
      </span>
    </div>
  );
}

function TopAgentCell({ result }: { result: AccountLookup }) {
  const agent = result.topAgents[0];
  if (!agent) return <span className="tools-result-meta">No data yet</span>;
  const winRate = agent.games > 0 ? Math.round((agent.wins / agent.games) * 100) : 0;
  return (
    <div className="comparison-cell-icon-row">
      <img src={agent.agentIconUrl} alt="" className="tools-agent-icon" />
      <span>
        {agent.agent} ({agent.games} games, {winRate}% WR)
      </span>
    </div>
  );
}

function RecentGamesCell({ result }: { result: AccountLookup }) {
  const recent = result.recentMatches.slice(0, 5);
  if (recent.length === 0) return <span className="tools-result-meta">No games yet</span>;
  return (
    <div className="comparison-recent-row">
      {recent.map((match, index) => (
        <Tooltip key={index} content={`${match.map} | ${match.result}`}>
          <span className={`comparison-outcome-chip comparison-outcome-chip--${match.result.toLowerCase()}`}>
            {match.result === 'Win' ? 'W' : match.result === 'Loss' ? 'L' : 'D'}
          </span>
        </Tooltip>
      ))}
    </div>
  );
}

function ComparisonResults({
  left,
  right,
  hint,
}: {
  left : AccountLookup;
  right: AccountLookup;
  hint?: string;
}) {
  return (
    <section className="surface-card tools-data-card comparison-results" data-tauri-drag-region>
      <div className="tools-panel-head" data-tauri-drag-region>
        <span className="tools-panel-title">Stat comparison</span>
        {hint ? <p className="tools-panel-hint">{hint}</p> : null}
      </div>
      <div className="comparison-table-wrap drag-surface">
        <table className="comparison-table">
          <thead>
            <tr>
              <th scope="col" className="comparison-table-metric-col">
                Metric
              </th>
              <th scope="col">
                <PlayerHeader result={left} />
              </th>
              <th scope="col">
                <PlayerHeader result={right} />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="comparison-row-label">Current rank</td>
              <td>
                <RankCell result={left} />
              </td>
              <td>
                <RankCell result={right} />
              </td>
            </tr>
            {ROWS.map((row) => {
              const winner = rowWinner(row, left, right);
              return (
                <tr key={row.label}>
                  <td className="comparison-row-label">{row.label}</td>
                  <td className={winner === 'left' ? 'comparison-cell-winner' : undefined}>{row.format(left)}</td>
                  <td className={winner === 'right' ? 'comparison-cell-winner' : undefined}>{row.format(right)}</td>
                </tr>
              );
            })}
            <tr>
              <td className="comparison-row-label">Top agent</td>
              <td>
                <TopAgentCell result={left} />
              </td>
              <td>
                <TopAgentCell result={right} />
              </td>
            </tr>
            <tr>
              <td className="comparison-row-label">Recent games</td>
              <td>
                <RecentGamesCell result={left} />
              </td>
              <td>
                <RecentGamesCell result={right} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SidePanel({
  side,
  title,
  savedOptions,
  onQueryChange,
  onPick,
  onSubmit,
  onUseMyAccount,
  onClear,
  onOpenSettings,
}: {
  side           : Side;
  title          : string;
  savedOptions   : DropdownOption[];
  onQueryChange  : (query: string) => void;
  onPick         : (riotId: string) => void;
  onSubmit       : () => void;
  onUseMyAccount : () => void;
  onClear        : () => void;
  onOpenSettings?: () => void;
}) {
  return (
    <ToolsPanel title={title} hint={SIDE_HINT}>
      <input
        type="text"
        className="tools-input"
        placeholder="Name#Tag"
        value={side.query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
      />
      {savedOptions.length > 0 && (
        <Dropdown
          value=""
          placeholder="Pick a saved account or player..."
          options={savedOptions}
          onChange={onPick}
        />
      )}
      <div className="tools-actions-row" data-tauri-drag-region>
        <button
          type="button"
          className="app-btn app-btn-primary app-btn-compact"
          disabled={side.loading}
          onClick={onSubmit}
        >
          {side.loading ? 'Looking up...' : 'Look up'}
        </button>
        <Tooltip content="Look up whoever's signed in to the Riot Client right now">
          <button
            type="button"
            className="app-btn app-btn-secondary app-btn-compact"
            disabled={side.loading}
            onClick={onUseMyAccount}
          >
            Use my account
          </button>
        </Tooltip>
        {side.result && (
          <button type="button" className="app-btn app-btn-secondary app-btn-compact" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {side.error && <ToolsInvokeError error={side.error} onOpenSettings={onOpenSettings} />}
      {side.loading && (
        <div className="skeleton-section" data-tauri-drag-region>
          <Skeleton height={64} />
          <Skeleton height={13} width="70%" />
          <Skeleton height={11} width="45%" />
        </div>
      )}
      {!side.loading && side.result && <SidePreview result={side.result} />}
    </ToolsPanel>
  );
}

interface Props {
  onOpenSettings?: () => void;
}

export function PlayerComparisonTool({ onOpenSettings }: Props = {}) {
  const [left, setLeft] = useState<Side>(EMPTY_SIDE);
  const [right, setRight] = useState<Side>(EMPTY_SIDE);
  const [savedAccounts, setSavedAccounts] = useState<Account[]>([]);
  const [savedPlayers, setSavedPlayers] = useState<SavedPlayer[]>([]);
  const leftRequestRef  = useRef(0);
  const rightRequestRef = useRef(0);

  useEffect(() => {
    listAccounts()
      .then(setSavedAccounts)
      .catch((e) => {
        logSilentFailure('comparison.accounts', e);
        setSavedAccounts([]);
      });
    listSavedPlayers()
      .then(setSavedPlayers)
      .catch((e) => {
        logSilentFailure('comparison.savedPlayers', e);
        setSavedPlayers([]);
      });
  }, []);

  const savedOptions: DropdownOption[] = [
    ...savedAccounts.map((account) => ({ value: account.label, label: account.label })),
    ...savedPlayers.map((player) => ({ value: `${player.name}#${player.tag}`, label: `${player.name}#${player.tag}` })),
  ];

  const runLookup = async (
    which: 'left' | 'right',
    setSide: (updater: (prev: Side) => Side) => void,
    query: string,
  ) => {
    const requestRef = which === 'left' ? leftRequestRef : rightRequestRef;
    const requestId  = ++requestRef.current;
    const parsed = parseRiotId(query);
    if (!parsed) {
      setSide((prev) => ({ ...prev, query, error: EMPTY_RIOT_ID_ERROR, result: null, loading: false }));
      return;
    }
    setSide((prev) => ({ ...prev, query, loading: true, error: null, result: null }));
    try {
      const result = await lookupAccount(parsed[0], parsed[1]);
      if (requestId !== requestRef.current) return;
      setSide(() => ({ query, loading: false, error: null, result }));
    } catch (e) {
      if (requestId !== requestRef.current) return;
      setSide(() => ({ query, loading: false, error: parseInvokeError(e), result: null }));
    }
  };

  const pickRiotId = (which: 'left' | 'right', setSide: (updater: (prev: Side) => Side) => void, riotId: string) => {
    setSide((prev) => ({ ...prev, query: riotId, error: null }));
    void runLookup(which, setSide, riotId);
  };

  const useMyAccount = async (
    which: 'left' | 'right',
    setSide: (updater: (prev: Side) => Side) => void,
  ) => {
    const requestRef = which === 'left' ? leftRequestRef : rightRequestRef;
    const requestId  = ++requestRef.current;
    setSide((prev) => ({ ...prev, loading: true, error: null, result: null }));
    try {
      const profile = await detectCurrentAccountProfile();
      if (requestId !== requestRef.current) return;
      const query  = `${profile.name}#${profile.tag}`;
      const result = await lookupAccount(profile.name, profile.tag);
      if (requestId !== requestRef.current) return;
      setSide(() => ({ query, loading: false, error: null, result }));
    } catch (e) {
      if (requestId !== requestRef.current) return;
      setSide((prev) => ({ ...prev, loading: false, error: parseInvokeError(e), result: null }));
    }
  };

  const bothLoaded = Boolean(left.result && right.result);
  const oneLoaded = Boolean(left.result || right.result);

  useEffect(() => {
    const size = bothLoaded ? COMPARISON_WINDOW_SIZE : BASE_WINDOW_SIZE;
    tweenWindowSize(size.width, size.height);
  }, [bothLoaded]);

  useEffect(() => {
    return () => {
      tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height);
    };
  }, []);

  const comparisonHint =
    bothLoaded && left.result && right.result
      ? `Stats from each player's last ${Math.min(left.result.gamesPlayed, right.result.gamesPlayed)} match sample.`
      : undefined;

  return (
    <div className="tools-stack" data-tauri-drag-region>
      <div className="comparison-sides drag-surface" data-tauri-drag-region>
        <SidePanel
          side={left}
          title="Player A"
          savedOptions={savedOptions}
          onQueryChange={(query) => setLeft((prev) => ({ ...prev, query, error: null }))}
          onPick={(riotId) => pickRiotId('left', setLeft, riotId)}
          onSubmit={() => void runLookup('left', setLeft, left.query)}
          onUseMyAccount={() => void useMyAccount('left', setLeft)}
          onClear={() => setLeft(EMPTY_SIDE)}
          onOpenSettings={onOpenSettings}
        />
        <SidePanel
          side={right}
          title="Player B"
          savedOptions={savedOptions}
          onQueryChange={(query) => setRight((prev) => ({ ...prev, query, error: null }))}
          onPick={(riotId) => pickRiotId('right', setRight, riotId)}
          onSubmit={() => void runLookup('right', setRight, right.query)}
          onUseMyAccount={() => void useMyAccount('right', setRight)}
          onClear={() => setRight(EMPTY_SIDE)}
          onOpenSettings={onOpenSettings}
        />
      </div>

      {bothLoaded && left.result && right.result ? (
        <ComparisonResults left={left.result} right={right.result} hint={comparisonHint} />
      ) : oneLoaded ? (
        <ToolsEmpty
          title="Load the other player"
          hint="Look up Player A and Player B to see stats compared side by side. Highlights show who leads on each metric."
        />
      ) : (
        <ToolsEmpty
          title="Compare two players"
          hint="Look up both Riot IDs, or pick from your saved accounts and players, to compare stats side by side."
        />
      )}
    </div>
  );
}