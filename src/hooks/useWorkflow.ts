import { useCallback, useEffect, useRef, useState } from 'react';

import { onWorkflowLog } from '../api/events';
import {
  cancelAction,
  checkForIssues,
  fixIssues,
  restartComputer,
  runAccountSwap,
  runAction,
  runManualAction,
} from '../api/workflow';
import type { LogLine, ManualAction, WorkflowAction } from '../types';
import { confirmIfEnabled } from '../utils/confirmGate';
import { hasIssues, issuesFoundNotice } from '../utils/issueReport';
import { parseInvokeError } from '../utils/userError';
import { toast, type NotificationContent } from './useToastStore';

const REBOOT_NOTICE: NotificationContent = {
  title: 'Your computer needs to restart',
  body: "Remote Desktop was on, which breaks the optimizer, so it's been turned off. Restart now to finish, or restart later yourself before running this again.",
};

export function useWorkflow() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);
  const workIdRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    onWorkflowLog((line) =>
      setLines((prev) => {
        if (line.replace && prev.length > 0 && prev[prev.length - 1].replace) {
          return [...prev.slice(0, -1), line];
        }
        return [...prev, line];
      }),
    ).then((fn) => {
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

  const beginWork = useCallback(() => {
    abortRef.current = false;
  }, []);

  const isAborted = useCallback(() => abortRef.current, []);

  const confirmUnlessAborted = useCallback(
    async (content: NotificationContent, options?: { confirmLabel?: string }) => {
      if (abortRef.current) return false;
      const accepted = await toast.confirm(content, options);
      if (abortRef.current) return false;
      return accepted;
    },
    [],
  );

  const runTracked = useCallback(async (run: () => Promise<unknown>, clearLogs = true) => {
    if (abortRef.current || runningRef.current) return;
    const workId = ++workIdRef.current;
    runningRef.current = true;
    if (clearLogs) setLines([]);
    setRunning(true);
    try {
      await run();
    } catch (error) {
      if (abortRef.current || workId !== workIdRef.current) return;
      const parsed = parseInvokeError(error);
      if (parsed.code === 'cancelled') return;
      const message = parsed.body ? `${parsed.title}. ${parsed.body}` : parsed.title;
      setLines((prev) => [...prev, { level: 'error', message }]);
    } finally {
      if (workId !== workIdRef.current) return;
      if (abortRef.current) {
        toast.cancelPendingConfirms();
      }
      runningRef.current = false;
      setRunning(false);
    }
  }, []);

  const start = useCallback(
    (action: WorkflowAction) => {
      beginWork();
      return runTracked(() => runAction(action));
    },
    [beginWork, runTracked],
  );

  const startConfirmed = useCallback(
    (action: WorkflowAction, notice: NotificationContent, confirmLabel: string) => {
      beginWork();
      return runTracked(async () => {
        if (abortRef.current) return;
        if (!(await confirmIfEnabled(notice, confirmLabel, () => abortRef.current))) return;
        if (abortRef.current) return;
        await runAction(action);
      });
    },
    [beginWork, runTracked],
  );

  const check = useCallback(() => {
    beginWork();
    return runTracked(async () => {
      if (abortRef.current) return;
      const outcome = await checkForIssues();
      if (abortRef.current) return;

      if (outcome.type === 'needsReboot') {
        if (await confirmUnlessAborted(REBOOT_NOTICE, { confirmLabel: 'Restart now' })) {
          if (abortRef.current) return;
          await restartComputer();
        }
        return;
      }

      const { report } = outcome;
      if (!hasIssues(report)) return;
      if (!(await confirmUnlessAborted(issuesFoundNotice(report), { confirmLabel: 'Auto Fix' }))) return;
      if (abortRef.current) return;
      await fixIssues(report);
    });
  }, [beginWork, confirmUnlessAborted, runTracked]);

  const cancel = useCallback(() => {
    abortRef.current = true;
    toast.cancelPendingConfirms();
    void cancelAction();
  }, []);

  const runManual = useCallback(
    (action: ManualAction) => {
      beginWork();
      return runTracked(() => runManualAction(action), action !== 'changeSeed');
    },
    [beginWork, runTracked],
  );

  const swap = useCallback(
    (accountIds: string[]) => {
      if (abortRef.current) return Promise.resolve();
      return runTracked(() => runAccountSwap(accountIds));
    },
    [runTracked],
  );

  const clearLogs = useCallback(() => setLines([]), []);

  return {
    lines,
    running,
    beginWork,
    isAborted,
    start,
    startConfirmed,
    check,
    cancel,
    confirmUnlessAborted,
    runManual,
    swap,
    clearLogs,
  };
}

export type WorkflowHandle = ReturnType<typeof useWorkflow>;