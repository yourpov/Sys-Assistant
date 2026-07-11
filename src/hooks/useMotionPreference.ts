import { useSyncExternalStore } from 'react';

import { getReduceMotion, subscribeReduceMotion } from '../utils/motionPreference';

export function useMotionPreference(): boolean {
  return useSyncExternalStore(subscribeReduceMotion, getReduceMotion, () => false);
}