import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { fetchCommunityConfigs } from '../api/communityConfigs';
import type { CommunityConfig } from '../types';
import { applyReactionDelta, REACTION_LIST_REFRESH_MS } from '../utils/reactionCounts';
import { logSilentFailure } from '../utils/silentError';

export function useReactionListPatch(
  setConfigs: Dispatch<SetStateAction<CommunityConfig[] | null>>,
) {
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  return useCallback((configId: string, delta: { likes: number; dislikes: number }) => {
    setConfigs((prev) =>
      prev?.map((config) =>
        config.id === configId
          ? { ...config, ...applyReactionDelta(config, delta) }
          : config,
      ) ?? prev,
    );

    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      fetchCommunityConfigs()
        .then(setConfigs)
        .catch((e) => logSilentFailure('configs.reactionCounts', e));
    }, REACTION_LIST_REFRESH_MS);
  }, [setConfigs]);
}