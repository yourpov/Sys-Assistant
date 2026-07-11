import { useCallback, useEffect, useRef, useState } from 'react';

import {
  automateWindowExtraHeight,
  AUTOMATE_ISLAND_OVERHEAD_PX,
  type AutomateLayoutReport,
} from '../utils/automateLayout';
import { logSilentFailure }                  from '../utils/silentError';
import { BASE_WINDOW_SIZE, tweenWindowSize } from '../utils/windowSize';

const AUTOMATE_WINDOW_HEIGHT = BASE_WINDOW_SIZE.height + AUTOMATE_ISLAND_OVERHEAD_PX;

function manualOptionsEqual(
a: AutomateLayoutReport['manualOptions'],
b: AutomateLayoutReport['manualOptions'],
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.open === b.open && a.actionCount === b.actionCount;
}

function layoutReportsEqual(a: AutomateLayoutReport, b: AutomateLayoutReport): boolean {
  return (
    a.consoleCollapsed === b.consoleCollapsed && manualOptionsEqual(a.manualOptions, b.manualOptions)
  );
}

export function useAutomateLayout() {
  const [report, setReport] = useState<AutomateLayoutReport>({});
  const lastHeightRef       = useRef(BASE_WINDOW_SIZE.height);

  const publishLayout = useCallback((patch: Partial<AutomateLayoutReport>) => {
    setReport((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch) as (keyof AutomateLayoutReport)[]) {
        const value = patch[key];
        if (value === undefined) delete next[key];
        else Object.assign(next, { [key]: value });
      }
      return layoutReportsEqual(prev, next) ? prev: next;
    });
  }, []);

  useEffect(() => {
    const extra        = automateWindowExtraHeight(report);
    const targetHeight = AUTOMATE_WINDOW_HEIGHT + extra;
    if (targetHeight === lastHeightRef.current) return;

    lastHeightRef.current = targetHeight;
    void tweenWindowSize(BASE_WINDOW_SIZE.width, targetHeight).catch((e) => {
      logSilentFailure('automateLayout.resize', e);
      lastHeightRef.current = AUTOMATE_WINDOW_HEIGHT;
    });
  }, [report]);

  useEffect(
    () => () => {
      lastHeightRef.current = BASE_WINDOW_SIZE.height;
      void tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height).catch((e) => logSilentFailure('automateLayout.reset', e));
    },
    [],
  );

  return { publishLayout };
}