import type { ValorantVersionStatus } from '../types';
import { Tooltip }                    from './Tooltip';

export function ValorantVersionInline({
  status,
}: {
  status: ValorantVersionStatus | null;
}) {
  const local      = status?.local?.label ?? '?';
  const latest     = status?.latest?.label ?? '?';
  const localHint  = status?.local?.riotClientVersion ?? 'Launch VALORANT once to detect your version.';
  const latestHint = status?.latest?.riotClientVersion ?? 'Could not fetch the latest public version.';

  return (
    <div     className = "tools-meta-block" data-tauri-drag-region>
    <span    className = "tools-meta-header">VALORANT</span>
    <div     className = "tools-version-split-pill">
    <Tooltip content   = {`Current version\n${localHint}`}>
    <span    className = "tools-version-split-side">{local}</span>
        </Tooltip>
        <span className = "tools-version-split-divider" aria-hidden = "true">
          /
        </span>
        <Tooltip content   = {`Latest version\n${latestHint}`}>
        <span    className = "tools-version-split-side">{latest}</span>
        </Tooltip>
      </div>
    </div>
  );
}