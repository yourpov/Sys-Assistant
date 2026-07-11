import { invoke } from '@tauri-apps/api/core';

import type { MatchPlayer, SavedPlayer } from '../types';

export function listSavedPlayers(): Promise<SavedPlayer[]> {
  return invoke('list_saved_players');
}

export function addSavedPlayer(
player: Pick<MatchPlayer, 'name' | 'tag' | 'rank' | 'rr' | 'rankIconUrl' | 'agent' | 'agentIconUrl'>,
)     : Promise<SavedPlayer> {
  return invoke('add_saved_player', {
    name        : player.name,
    tag         : player.tag,
    rank        : player.rank,
    rr          : player.rr,
    rankIconUrl : player.rankIconUrl ?? null,
    agent       : player.agent,
    agentIconUrl: player.agentIconUrl,
  });
}

export function removeSavedPlayer(id: string): Promise<void> {
  return invoke('remove_saved_player', { id });
}