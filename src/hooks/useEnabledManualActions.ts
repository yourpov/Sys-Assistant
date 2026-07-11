import { useEffect, useState } from 'react';

import { getSettings }       from '../api/settings';
import type { ManualAction } from '../types';
import { logSilentFailure }  from '../utils/silentError';

export function useEnabledManualActions(): ManualAction[] | null {
  const [enabled, setEnabled] = useState<ManualAction[] | null>(null);

  useEffect(() => {
    getSettings()
      .then((settings) => setEnabled(settings.manualActionsEnabled))
      .catch((e) => {
        logSilentFailure('manualActions.settings', e);
        setEnabled([]);
      });
  }, []);

  return enabled;
}