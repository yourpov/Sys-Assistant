import { useEffect, useMemo, useState } from 'react';

import { AnimatedLink } from '@/components/ui/animated-link';

import { listSavedPlayers, removeSavedPlayer } from '../api/savedPlayers';
import { CLIPBOARD_ACK_MS }                                 from '../constants/timing';
import { toast }                                            from '../hooks/useToastStore';
import { toastFromError }                                   from '../utils/userError';
import type { SavedPlayer }                                 from '../types';
import { riotId }                                           from '../utils/playerId';
import { notifySavedPlayersChanged, onSavedPlayersChanged } from '../utils/savedPlayersEvents';
import { Skeleton }                                         from './Skeleton';
import { Tooltip }                                          from './Tooltip';
import { ToolsPanel }                                       from './ToolsUi';

interface Props {
  onLookup    : (riotId: string) => void;
  onOpenLobby?: () => void;
}

function formatRank(player: SavedPlayer): string {
  if (!player.rank) return 'Unranked';
  return player.rr !== null ? `${player.rank} | ${player.rr} RR` : player.rank;
}

export function SavedPlayersTool({ onLookup, onOpenLobby }: Props) {
  const [players, setPlayers]       = useState<SavedPlayer[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [copiedId, setCopiedId]     = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const refresh = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      setPlayers(await listSavedPlayers());
    } catch (e) {
      if (!options?.silent) {
        toast.error(toastFromError(e, { title: "Couldn't load saved players" }));
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    return onSavedPlayersChanged(() => {
      void refresh({ silent: true });
    });
  }, []);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return players;
    return players.filter((player) => {
      const id    = riotId(player.name, player.tag).toLowerCase();
      const rank  = (player.rank ?? 'unranked').toLowerCase();
      const agent = (player.agent ?? '').toLowerCase();
      return id.includes(query) || rank.includes(query) || agent.includes(query);
    });
  }, [players, search]);

  const copyRiotId = async (player: SavedPlayer) => {
    try {
      await navigator.clipboard.writeText(riotId(player.name, player.tag));
      setCopiedId(player.id);
      setTimeout(() => setCopiedId((current) => (current === player.id ? null : current)), CLIPBOARD_ACK_MS);
    } catch (e) {
      toast.error({
        title: "That Riot ID couldn't be copied",
        body : 'Allow clipboard access in your browser settings, then try again.',
      });
    }
  };

  const requestRemove = async (player: SavedPlayer) => {
    const confirmed = await toast.confirm(
      {
        title: `Remove ${riotId(player.name, player.tag)}?`,
        body : 'They will be removed from your saved players collection.',
        icon : 'warning',
      },
      { confirmLabel: 'Remove' },
    );
    if (!confirmed) return;

    setRemovingId(player.id);
    try {
      await removeSavedPlayer(player.id);
      setPlayers((prev) => prev.filter((entry) => entry.id !== player.id));
      notifySavedPlayersChanged();
      toast.success({ title: 'Player removed', body: `${riotId(player.name, player.tag)} was removed from your collection.` });
    } catch (e) {
      toast.error(toastFromError(e, { title: "Couldn't remove player" }));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className = "tools-stack saved-players-tool" data-tauri-drag-region>
      <ToolsPanel>
        <input
          type        = "text"
          className   = "tools-input"
          placeholder = "Search saved players..."
          value       = {search}
          onChange    = {(e) => setSearch(e.target.value)}
          disabled    = {loading}
        />
      </ToolsPanel>

      {loading && (
        <div className = "account-list" data-tauri-drag-region>
          {Array.from({ length: 4 }).map((_, i) => (
            <div      key       = {i} className = "surface-card account-row" data-tauri-drag-region>
            <Skeleton width     = {40} height   = {40} className = "rounded-full" />
            <div      className = "account-row-body" data-tauri-drag-region>
            <Skeleton width     = {120} height  = {14} />
            <Skeleton width     = {80} height   = {11} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && players.length === 0 && (
        <div className = "tools-empty" data-tauri-drag-region>
        <p   className = "tools-empty-title">No saved players</p>
        <p   className = "tools-empty-hint">
            Bookmark players from {' '}
            {onOpenLobby ? (
              <AnimatedLink variant="left" showArrow={false} onClick={onOpenLobby}>
                Lobby
              </AnimatedLink>
            ) : (
              'Lobby'
            )}
            .
          </p>
        </div>
      )}

      {!loading && players.length > 0 && filteredPlayers.length === 0 && (
        <p className = "settings-error drag-surface">No saved players match "{search}".</p>
      )}

      {!loading && filteredPlayers.length > 0 && (
        <div className = "account-list" data-tauri-drag-region>
          {filteredPlayers.map((player) => (
            <SavedPlayerRow
              key      = {player.id}
              player   = {player}
              copied   = {copiedId === player.id}
              removing = {removingId === player.id}
              onCopy   = {() => void copyRiotId(player)}
              onLookup = {() => onLookup(riotId(player.name, player.tag))}
              onRemove = {() => void requestRemove(player)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedPlayerRow({
  player,
  copied,
  removing,
  onCopy,
  onLookup,
  onRemove,
}: {
  player  : SavedPlayer;
  copied  : boolean;
  removing: boolean;
  onCopy  : () => void;
  onLookup: () => void;
  onRemove: () => void;
}) {
  const displayId = riotId(player.name, player.tag);

  return (
    <div     className = "surface-card account-row tools-saved-player-row" data-tauri-drag-region>
    <Tooltip content   = {formatRank(player)}>
    <div     className = "tools-saved-player-rank" data-tauri-drag-region>
          {player.rankIconUrl ? (
            <img src = {player.rankIconUrl} alt = "" className = "tools-rank-icon" aria-hidden = "true" />
          ) : (
            <span className = "tools-saved-player-rank-fallback" aria-hidden = "true">
              ?
            </span>
          )}
        </div>
      </Tooltip>

      <div     className = "account-row-body" data-tauri-drag-region>
      <div     className = "account-row-top" data-tauri-drag-region>
      <Tooltip content   = {copied ? 'Copied!' : 'Click to copy Riot ID'}>
      <button  type      = "button" className = "account-row-label account-row-label-copyable" onClick = {onCopy}>
              {copied ? 'Copied!' : displayId}
            </button>
          </Tooltip>
        </div>
        <span className = "account-row-username">{player.agent ?? 'Unknown agent'}</span>
      </div>

      <div     className = "account-row-actions" data-tauri-drag-region>
      <div     className = "account-row-main-actions">
      <Tooltip content   = "Open in Lookup tab">
      <button  type      = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {onLookup}>
              Lookup
            </button>
          </Tooltip>
          <Tooltip content = "Remove from collection">
          <button  type    = "button" className = "app-btn app-btn-danger app-btn-compact" disabled = {removing} onClick = {onRemove}>
              {removing ? '...' : 'Remove'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}