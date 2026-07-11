import { openUrl } from '@tauri-apps/plugin-opener';
import type { ReactNode } from 'react';

import { AnimatedLink } from '@/components/ui/animated-link';

import { HENRIK_DASHBOARD_URL } from '../constants/urls';
import { parseInvokeError } from '../utils/userError';

interface Props {
  error     : unknown;
  className?: string;
  onRetry  ?: () => void;
  retryLabel?: string;
}

export function ErrorDisplay({ error, className = 'settings-error drag-surface', onRetry, retryLabel = 'Try again' }: Props) {
  const parsed = parseInvokeError(error);

  return (
    <div className = {className} role = "alert" aria-live = "polite">
      <div className = "error-display-row">
        <span className = "error-display-icon" aria-hidden = "true">
          <svg width = "16" height = "16" viewBox = "0 0 16 16" fill = "none">
            <path
              d = "M8 1.5 14.5 13.5H1.5L8 1.5Z"
              stroke = "currentColor"
              strokeWidth = "1.25"
              strokeLinejoin = "round"
            />
            <path d = "M8 6V9" stroke = "currentColor" strokeWidth = "1.25" strokeLinecap = "round" />
            <circle cx = "8" cy = "11.25" r = "0.75" fill = "currentColor" />
          </svg>
        </span>
        <div className = "error-display-copy">
          <p className = "error-display-title">{parsed.title}</p>
          {parsed.body ? <p className = "error-display-body">{parsed.body}</p> : null}
        </div>
      </div>
      {onRetry ? (
        <AnimatedLink variant="left" showArrow className="error-display-retry" onClick={onRetry}>
          {retryLabel}
        </AnimatedLink>
      ) : null}
    </div>
  );
}

interface EmptyErrorProps {
  title : string;
  hint  : ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ToolsInvokeError({
  error,
  onOpenSettings,
  onRetry,
}: {
  error          : unknown;
  onOpenSettings?: () => void;
  onRetry        ?: () => void;
}) {
  const parsed = parseInvokeError(error);

  if (parsed.code === 'henrik_api_key_missing') {
    return (
      <div className = "settings-error drag-surface" role = "alert" aria-live = "polite">
        <div className = "error-display-row">
          <span className = "error-display-icon" aria-hidden = "true">
            <svg width = "16" height = "16" viewBox = "0 0 16 16" fill = "none">
              <path d = "M8 1.5 14.5 13.5H1.5L8 1.5Z" stroke = "currentColor" strokeWidth = "1.25" strokeLinejoin = "round" />
              <path d = "M8 6V9" stroke = "currentColor" strokeWidth = "1.25" strokeLinecap = "round" />
              <circle cx = "8" cy = "11.25" r = "0.75" fill = "currentColor" />
            </svg>
          </span>
          <div className = "error-display-copy">
            <p className = "error-display-title">{parsed.title}</p>
            <p className = "error-display-body">
              Get a free key from the{' '}
              <AnimatedLink variant="left" showArrow={false} onClick={() => void openUrl(HENRIK_DASHBOARD_URL)}>
                HenrikDev dashboard
              </AnimatedLink>
              , then paste it into{' '}
              {onOpenSettings ? (
                <AnimatedLink variant="left" showArrow={false} onClick={onOpenSettings}>
                  Settings, Tools
                </AnimatedLink>
              ) : (
                'Settings, Tools'
              )}
              .
            </p>
          </div>
        </div>
        {onRetry ? (
          <AnimatedLink variant="left" showArrow className="error-display-retry" onClick={onRetry}>
            Try again
          </AnimatedLink>
        ) : null}
      </div>
    );
  }

  return <ErrorDisplay error = {parsed} onRetry = {onRetry} />;
}

export function EmptyErrorState({ title, hint, onRetry, retryLabel = 'Try again' }: EmptyErrorProps) {
  return (
    <div className = "tools-empty tools-empty--error" role = "status" aria-live = "polite" data-tauri-drag-region>
      <span className = "tools-empty-icon" aria-hidden = "true">
        <svg width = "20" height = "20" viewBox = "0 0 16 16" fill = "none">
          <path
            d = "M8 1.5 14.5 13.5H1.5L8 1.5Z"
            stroke = "currentColor"
            strokeWidth = "1.25"
            strokeLinejoin = "round"
          />
          <path d = "M8 6V9" stroke = "currentColor" strokeWidth = "1.25" strokeLinecap = "round" />
          <circle cx = "8" cy = "11.25" r = "0.75" fill = "currentColor" />
        </svg>
      </span>
      <p className = "tools-empty-title">{title}</p>
      <div className = "tools-empty-hint">{hint}</div>
      {onRetry ? (
        <button type = "button" className = "app-btn app-btn-secondary app-btn-compact tools-empty-retry" onClick = {onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}