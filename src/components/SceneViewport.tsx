import { useCallback, useEffect, useState } from 'react';

import { SplineScene } from './ui/SplineScene';

const FADE_DURATION_MS = 300;

interface SceneViewportProps {
  onDismiss: () => void;
  showProgress?: boolean;
  durationMs?: number;
  hint?: string;
  interactive?: boolean;
}

export function SceneViewport({
  onDismiss,
  showProgress = false,
  durationMs = 5000,
  hint,
  interactive = false,
}: SceneViewportProps) {
  const [closing, setClosing] = useState(false);

  const dismiss = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onDismiss, FADE_DURATION_MS);
  }, [closing, onDismiss]);

  useEffect(() => {
    if (!showProgress) return;

    const closeTimer  = window.setTimeout(() => setClosing(true), durationMs - FADE_DURATION_MS);
    const finishTimer = window.setTimeout(onDismiss, durationMs);
    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(finishTimer);
    };
  }, [durationMs, onDismiss, showProgress]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismiss]);

  return (
    <div
      className="scene-viewport"
      style={{ opacity: closing ? 0 : 1 }}
      onClick={interactive ? undefined : dismiss}
      role="presentation"
    >
      <SplineScene passive={!interactive} />
      <div className="scene-viewport-chrome" aria-hidden={!showProgress && !hint && !interactive}>
        {interactive ? (
          <button
            type="button"
            className="app-btn app-btn-secondary app-btn-compact scene-viewport-close"
            onClick={(event) => {
              event.stopPropagation();
              dismiss();
            }}
          >
            Close
          </button>
        ) : null}
        {showProgress ? (
          <div className="splash-progress-track">
            <div
              className="splash-progress-fill"
              style={{ animationDuration: `${durationMs - FADE_DURATION_MS}ms` }}
            />
          </div>
        ) : null}
        {hint ? <p className="scene-viewport-hint">{hint}</p> : null}
      </div>
    </div>
  );
}