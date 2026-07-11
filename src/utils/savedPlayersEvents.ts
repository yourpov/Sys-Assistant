export const SAVED_PLAYERS_CHANGED_EVENT = 'saved-players-changed';

export function notifySavedPlayersChanged(): void {
  window.dispatchEvent(new CustomEvent(SAVED_PLAYERS_CHANGED_EVENT));
}

export function onSavedPlayersChanged(listener: () => void): () => void {
  window.addEventListener(SAVED_PLAYERS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(SAVED_PLAYERS_CHANGED_EVENT, listener);
}