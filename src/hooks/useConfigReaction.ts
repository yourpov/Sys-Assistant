import { useCallback, useEffect, useRef, useState } from 'react';

import { clearConfigReaction, fetchConfigReaction, setConfigReaction } from '../api/communityConfigs';
import {
  clampReactionCounts,
  nextReaction,
  reactionCountDelta,
  REACTION_FLUSH_MS,
  type Reaction,
} from '../utils/reactionCounts';
import { logSilentFailure } from '../utils/silentError';
import { toastFromError } from '../utils/userError';
import { toast } from './useToastStore';

type ReactionDelta = { likes: number; dislikes: number };

export function useConfigReaction({
  configId,
  likes,
  dislikes,
  signedIn,
  onReactionChange,
}: {
  configId         : string;
  likes            : number;
  dislikes         : number;
  signedIn         : boolean;
  onReactionChange?: (configId: string, delta: ReactionDelta) => void;
}) {
  const [displayReaction, setDisplayReaction] = useState<Reaction>(null);
  const [displayLikes, setDisplayLikes]       = useState(likes);
  const [displayDislikes, setDisplayDislikes] = useState(dislikes);
  const [reactionReady, setReactionReady]     = useState(!signedIn);

  const syncedReactionRef = useRef<Reaction>(null);
  const flushTargetRef    = useRef<Reaction>(null);
  const flushTimerRef     = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flushingRef       = useRef(false);
  const loadGenerationRef = useRef(0);

  const resetDisplayFromServer = useCallback(() => {
    const clamped = clampReactionCounts(likes, dislikes);
    setDisplayLikes(clamped.likes);
    setDisplayDislikes(clamped.dislikes);
    setDisplayReaction(syncedReactionRef.current);
  }, [likes, dislikes]);

  useEffect(() => {
    const clamped = clampReactionCounts(likes, dislikes);
    setDisplayLikes(clamped.likes);
    setDisplayDislikes(clamped.dislikes);
  }, [configId, likes, dislikes]);

  useEffect(() => {
    if (!signedIn) {
      syncedReactionRef.current = null;
      flushTargetRef.current    = null;
      setDisplayReaction(null);
      setReactionReady(true);
      return;
    }

    const generation = ++loadGenerationRef.current;
    setReactionReady(false);
    fetchConfigReaction(configId)
      .then((reaction) => {
        if (generation !== loadGenerationRef.current) return;
        syncedReactionRef.current = reaction;
        flushTargetRef.current    = reaction;
        setDisplayReaction(reaction);
      })
      .catch((e) => {
        logSilentFailure('configs.reaction', e);
        if (generation !== loadGenerationRef.current) return;
        syncedReactionRef.current = null;
        flushTargetRef.current    = null;
        setDisplayReaction(null);
      })
      .finally(() => {
        if (generation === loadGenerationRef.current) setReactionReady(true);
      });

    return () => {
      loadGenerationRef.current += 1;
    };
  }, [configId, signedIn]);

  useEffect(() => () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
  }, []);

  const runFlush = useCallback(async () => {
    const target = flushTargetRef.current;
    if (!signedIn || target === syncedReactionRef.current) return;

    if (flushingRef.current) {
      flushTimerRef.current = setTimeout(() => void runFlush(), REACTION_FLUSH_MS);
      return;
    }

    flushingRef.current = true;
    try {
      if (target === null) await clearConfigReaction(configId);
      else await setConfigReaction(configId, target);
      syncedReactionRef.current = target;
    } catch (err) {
      toast.error(toastFromError(err, { title: "Couldn't update your reaction" }));
      try {
        const reaction = await fetchConfigReaction(configId);
        syncedReactionRef.current = reaction;
        flushTargetRef.current    = reaction;
        setDisplayReaction(reaction);
      } catch (e) {
        logSilentFailure('configs.reaction.resync', e);
        resetDisplayFromServer();
      }
    } finally {
      flushingRef.current = false;
      if (flushTargetRef.current !== syncedReactionRef.current) {
        flushTimerRef.current = setTimeout(() => void runFlush(), REACTION_FLUSH_MS);
      }
    }
  }, [configId, resetDisplayFromServer, signedIn]);

  const scheduleFlush = useCallback((target: Reaction) => {
    flushTargetRef.current = target;
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => void runFlush(), REACTION_FLUSH_MS);
  }, [runFlush]);

  const toggleReaction = useCallback((value: 1 | -1) => {
    if (!signedIn || !reactionReady) return;

    const next = nextReaction(displayReaction, value);
    const delta = reactionCountDelta(displayReaction, next);
    setDisplayReaction(next);
    setDisplayLikes((prev) => Math.max(0, prev + delta.likes));
    setDisplayDislikes((prev) => Math.max(0, prev + delta.dislikes));
    onReactionChange?.(configId, delta);
    scheduleFlush(next);
  }, [configId, displayReaction, onReactionChange, reactionReady, scheduleFlush, signedIn]);

  return {
    displayReaction,
    displayLikes,
    displayDislikes,
    reactionReady,
    toggleReaction,
  };
}