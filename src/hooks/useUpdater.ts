import { invoke }                                 from '@tauri-apps/api/core';
import { listen }                                 from '@tauri-apps/api/event';
import { relaunch }                               from '@tauri-apps/plugin-process';
import { useCallback, useEffect, useRef, useState } from 'react';

import { logSilentFailure }                       from '../utils/silentError';
import { parseInvokeError, type UserFacingError } from '../utils/userError';

type UpdateStatus = 'idle' | 'available' | 'downloading' | 'relaunching' | 'error';

interface UpdateInfo {
  version  : string;
  notes    : string | null;
  url      : string;
  signature: string;
}

interface DownloadProgress {
  downloaded: number;
  total     : number;
}

export function useUpdater() {
  const [status, setStatus]     = useState<UpdateStatus>('idle');
  const [version, setVersion]   = useState<string | null>(null);
  const [notes, setNotes]       = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState<UserFacingError | null>(null);
  const updateRef               = useRef<UpdateInfo | null>(null);

  useEffect(() => {
    invoke<UpdateInfo | null>('check_for_update')
      .then((update) => {
        if (update) {
          updateRef.current = update;
          setVersion(update.version);
          setNotes(update.notes ?? null);
          setStatus('available');
        }
      })
      .catch((e) => logSilentFailure('updater.check', e));
  }, []);

  const install = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    setStatus('downloading');
    setProgress(0);
    setError(null);

    const unlisten = await listen<DownloadProgress>('update://progress', (event) => {
      const { downloaded, total } = event.payload;
      setProgress(total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0);
    });

    try {
      await invoke('download_and_apply_update', { url: update.url, signature: update.signature });
      setProgress(100);
      setStatus('relaunching');
      await relaunch();
    } catch (e) {
      setError(parseInvokeError(e));
      setStatus('error');
    } finally {
      unlisten();
    }
  }, []);

  const dismiss = useCallback(() => {
    setStatus('idle');
  }, []);

  return { status, version, notes, progress, error, install, dismiss };
}
