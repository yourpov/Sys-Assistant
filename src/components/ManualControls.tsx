import { useCallback, useEffect } from 'react';

import { MANUAL_ACTIONS }            from '../constants/manualActions';
import { useEnabledManualActions }   from '../hooks/useEnabledManualActions';
import type { AutomateLayoutReport } from '../utils/automateLayout';
import type { ManualAction }         from '../types';
import { AutomateExpandable }        from './AutomateExpandable';
import { AutomateSection }           from './AutomateSection';
import { Tooltip }                   from './Tooltip';

interface ManualControlsProps {
  disabled        : boolean;
  onSelect        : (action: ManualAction) => void;
  onLayoutReport? : (patch: Partial<AutomateLayoutReport>) => void;
}

function ManualActionButton({
  label,
  hint,
  disabled,
  onClick,
}: {
  label   : string;
  hint    : string;
  disabled: boolean;
  onClick : () => void;
}) {
  return (
    <Tooltip content = {hint}>
    <button  type    = "button" className = "manual-control-button" disabled = {disabled} onClick = {onClick}>
        {label}
      </button>
    </Tooltip>
  );
}

function ManualGrid({
  actions,
  disabled,
  onSelect,
}: {
  actions : typeof MANUAL_ACTIONS;
  disabled: boolean;
  onSelect: (action: ManualAction) => void;
}) {
  return (
    <div className = "manual-controls-grid" data-tauri-drag-region>
      {actions.map(({ action, label, hint }) => (
        <ManualActionButton
          key      = {action}
          label    = {label}
          hint     = {hint}
          disabled = {disabled}
          onClick  = {() => onSelect(action)}
        />
      ))}
    </div>
  );
}

function SingleManualPanel({
  label,
  hint,
  disabled,
  onClick,
}: {
  label   : string;
  hint    : string;
  disabled: boolean;
  onClick : () => void;
}) {
  return (
    <AutomateSection    title = "Manual step" hint = "Runs a single action enabled in Settings.">
    <ManualActionButton label = {label} hint       = {hint} disabled = {disabled} onClick = {onClick} />
    </AutomateSection>
  );
}

export function ManualControls({ disabled, onSelect, onLayoutReport }: ManualControlsProps) {
  const enabled = useEnabledManualActions();
  const actions = enabled ? MANUAL_ACTIONS.filter(({ action }) => enabled.includes(action)) : [];

  const reportManualLayout = useCallback(
    (open: boolean) => {
      if (!onLayoutReport || actions.length <= 1) return;
      onLayoutReport({ manualOptions: { open, actionCount: actions.length } });
    },
    [actions.length, onLayoutReport],
  );

  useEffect(() => {
    if (!onLayoutReport) return;
    if (actions.length <= 1) onLayoutReport({ manualOptions: undefined });
  }, [actions.length, onLayoutReport]);

  useEffect(
    () => () => {
      onLayoutReport?.({ manualOptions: undefined });
    },
    [onLayoutReport],
  );

  if (!enabled) return null;
  if (actions.length === 0) return null;

  if (actions.length === 1) {
    const  { action, label, hint }  = actions[0];
    return <SingleManualPanel label = {label} hint = {hint} disabled = {disabled} onClick = {() => onSelect(action)} />;
  }

  return (
    <AutomateExpandable
      sectionId = "manual-options"
      title     = "Manual options"
      hint      = "Run the steps manually."
      persist
      disabled     = {disabled}
      onOpenChange = {reportManualLayout}
    >
      <ManualGrid actions = {actions} disabled = {disabled} onSelect = {onSelect} />
    </AutomateExpandable>
  );
}