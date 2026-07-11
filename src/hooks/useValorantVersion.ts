import { useEffect, useState } from 'react';

import { fetchValorantVersionStatus } from '../api/tools';
import type { ValorantVersionStatus } from '../types';
import { logSilentFailure } from '../utils/silentError';

const POLL_MS = 5 * 60 * 1000;

export function useValorantVersion() {
  const [status, setStatus]   = useState<ValorantVersionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      fetchValorantVersionStatus()
        .then((next) => {
          if (cancelled) return;
          setStatus(next);
          setLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          logSilentFailure('valorantVersion', e);
          setLoading(false);
        });
    };

    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { status, loading };
}