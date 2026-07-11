import { relaunch }                                 from '@tauri-apps/plugin-process';
import { check, type Update }                       from '@tauri-apps/plugin-updater';
import { useCallback, useEffect, useRef, useState } from 'react';

import { logSilentFailure }                     from '../utils/silentError';
import { parseInvokeError, type UserFacingError } from '../utils/userError';

type UpdateStatus = 'idle' | 'available' | 'downloading' | 'relaunching' | 'error';

export function useUpdater() {
  const [status, setStatus]     = useState<UpdateStatus>('idle');
  const [version, setVersion]   = useState<string | null>(null);
  const [notes, setNotes]       = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState<UserFacingError | null>(null);
  const updateRef               = useRef<Update | null>(null);

  useEffect(() => {
    check()
      .then((update) => {
        if (update) {
          updateRef.current = update;
          setVersion(update.version);
          setNotes(update.body ?? null);
          setStatus('available');
        }
      })
      .catch((e) => logSilentFailure('updater.check', e));
  }, []);

  const install = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    setStatus('downloading');
    setError(null);
    try {
      let total      = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          setProgress(total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0);
        } else if (event.event === 'Finished') {
          setProgress(100);
        }
      });
      setStatus('relaunching');
      await relaunch();
    } catch (e) {
      setError(parseInvokeError(e));
      setStatus('error');
    }
  }, []);

  const dismiss = useCallback(() => {
    setStatus('idle');
  }, []);

  return { status, version, notes, progress, error, install, dismiss };
}