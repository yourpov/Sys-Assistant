import { useEffect, useState } from 'react';

import { AUTOMATE_PILL_IDLE_MS } from '../constants/timing';
import type { LogLine } from '../types';
import { resolveAutomatePillState, type AutomatePillState } from '../utils/automateStatus';

export function useAutomatePillDisplayState(
  running: boolean,
  swapPreparing: boolean,
  lines: LogLine[],
): AutomatePillState {
  const raw = resolveAutomatePillState(running, swapPreparing, lines);
  const [display, setDisplay] = useState<AutomatePillState>(raw);

  useEffect(() => {
    if (running) {
      setDisplay('running');
      return;
    }
    if (swapPreparing) {
      setDisplay('warning');
      return;
    }
    if (raw === 'ready') {
      setDisplay('ready');
      return;
    }

    setDisplay(raw);
    const timer = window.setTimeout(() => setDisplay('ready'), AUTOMATE_PILL_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [running, swapPreparing, raw, lines]);

  return display;
}