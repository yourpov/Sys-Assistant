export type Reaction = 1 | -1 | null;

export const REACTION_FLUSH_MS = 180;
export const REACTION_LIST_REFRESH_MS = 500;

export function nextReaction(current: Reaction, clicked: 1 | -1): Reaction {
  return current === clicked ? null : clicked;
}

export function reactionCountDelta(from: Reaction, to: Reaction): { likes: number; dislikes: number } {
  const delta = { likes: 0, dislikes: 0 };
  if (from === 1) delta.likes -= 1;
  if (from === -1) delta.dislikes -= 1;
  if (to === 1) delta.likes += 1;
  if (to === -1) delta.dislikes += 1;
  return delta;
}

export function clampReactionCounts(likes: number, dislikes: number): { likes: number; dislikes: number } {
  return { likes: Math.max(0, likes), dislikes: Math.max(0, dislikes) };
}

export function applyReactionDelta(
  counts: { likes: number; dislikes: number },
  delta: { likes: number; dislikes: number },
): { likes: number; dislikes: number } {
  return clampReactionCounts(counts.likes + delta.likes, counts.dislikes + delta.dislikes);
}