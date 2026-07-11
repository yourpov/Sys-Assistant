import type { ReactNode } from 'react';

import type { LiveMatchSnapshot } from '../types';
import { ErrorDisplay } from './ErrorDisplay';

function LiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div  className = "tools-live-stat" data-tauri-drag-region>
    <span className = "tools-meta-label">{label}</span>
    <span className = "tools-meta-value-chip">{value}</span>
    </div>
  );
}

export function ToolsPanel({
  title,
  hint,
  children,
  className,
}: {
  title    ?: string;
  hint     ?: string;
  children  : ReactNode;
  className?: string;
}) {
  return (
    <section className = {`surface-card tools-panel${className ? ` ${className}` : ''}`} data-tauri-drag-region>
      {(title || hint) && (
        <div className = "tools-panel-head" data-tauri-drag-region>
          {title ? <span className="tools-panel-title">{title}</span> : null}
          {hint ? <p className="tools-panel-hint">{hint}</p> : null}
        </div>
      )}
      <div className = "tools-panel-body drag-surface">{children}</div>
    </section>
  );
}

export function ToolsEmpty({ title, hint }: { title: string; hint: ReactNode }) {
  return (
    <div className = "tools-empty" role = "status" aria-live = "polite" data-tauri-drag-region>
      <p className = "tools-empty-title">{title}</p>
      <div className = "tools-empty-hint">{hint}</div>
    </div>
  );
}

export function LiveMatchPills({
  snapshot,
  error,
}: {
  snapshot: LiveMatchSnapshot | null;
  error   : unknown;
}) {
  if (error) {
    return <ErrorDisplay error = {error} />;
  }

  if (!snapshot?.inMatch) {
    return null;
  }

  return (
    <div      className = "tools-live-pills tools-live-pills--inline" data-tauri-drag-region>
    <LiveStat label     = "Map" value    = {snapshot.mapName ?? 'Unknown'} />
    <LiveStat label     = "Region" value = {snapshot.region?.toUpperCase() ?? 'Unknown'} />
    <LiveStat label     = "Rounds" value = {String(snapshot.roundsCompleted)} />
    </div>
  );
}

export function ToolsSubsectionBar<T extends string>({
  sections,
  active,
  onChange,
}: {
  sections: readonly T[];
  active  : T;
  onChange: (section: T) => void;
}) {
  return (
    <div className = "tools-subsection-bar" data-tauri-drag-region>
    <div className = "tools-subsection-pill-bar" role = "tablist" data-tauri-drag-region>
        {sections.map((section) => (
          <button
            key           = {section}
            type          = "button"
            role          = "tab"
            aria-selected = {section === active}
            className     = {`tools-subsection-pill${section === active ? ' active' : ''}`}
            onClick       = {() => onChange(section)}
          >
            {section}
          </button>
        ))}
      </div>
    </div>
  );
}