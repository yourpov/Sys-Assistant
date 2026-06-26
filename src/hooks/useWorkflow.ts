import { useCallback, useEffect, useState } from 'react';

import { onWorkflowLog } from '../api/events';
import { cancelAction, checkForIssues, fixIssues, restartComputer, runAccountSwap, runAction, runManualAction } from '../api/workflow';
import type { IssueReport, LogLine, ManualAction, WorkflowAction } from '../types';

export function useWorkflow() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [needsReboot, setNeedsReboot] = useState(false);
  const [pendingFix, setPendingFix] = useState<IssueReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    onWorkflowLog((line) => setLines((prev) => [...prev, line])).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const start = useCallback(async (action: WorkflowAction) => {
    setLines([]);
    setRunning(true);
    try {
      await runAction(action);
    } catch {
    } finally {
      setRunning(false);
    }
  }, []);

  const check = useCallback(async () => {
    setLines([]);
    setRunning(true);
    try {
      const outcome = await checkForIssues();
      if (outcome.type === 'needsReboot') {
        setNeedsReboot(true);
      } else {
        const { report } = outcome;
        const hasIssues = !report.riotRunning || !report.staySignedIn || !report.coreIsolationEnabled || report.missingFiles.length > 0;
        if (hasIssues) setPendingFix(report);
      }
    } catch {
    } finally {
      setRunning(false);
    }
  }, []);

  const confirmFix = useCallback(async () => {
    if (!pendingFix) return;
    const report = pendingFix;
    setPendingFix(null);
    setRunning(true);
    try {
      await fixIssues(report);
    } catch {
    } finally {
      setRunning(false);
    }
  }, [pendingFix]);

  const dismissFix = useCallback(() => setPendingFix(null), []);

  const confirmReboot = useCallback(async () => {
    setNeedsReboot(false);
    try {
      await restartComputer();
    } catch (e) {
      setLines((prev) => [...prev, { level: 'error', message: String(e) }]);
    }
  }, []);

  const dismissReboot = useCallback(() => setNeedsReboot(false), []);

  const cancel = useCallback(() => {
    void cancelAction();
  }, []);

  const runManual = useCallback(async (action: ManualAction) => {
    setLines([]);
    setRunning(true);
    try {
      await runManualAction(action);
    } catch {
    } finally {
      setRunning(false);
    }
  }, []);

  const swap = useCallback(async (accountIds: string[]) => {
    setLines([]);
    setRunning(true);
    try {
      await runAccountSwap(accountIds);
    } catch {
    } finally {
      setRunning(false);
    }
  }, []);

  const clearLogs = useCallback(() => setLines([]), []);

  return {
    lines,
    running,
    needsReboot,
    pendingFix,
    start,
    check,
    confirmFix,
    dismissFix,
    confirmReboot,
    dismissReboot,
    cancel,
    runManual,
    swap,
    clearLogs,
  };
}
