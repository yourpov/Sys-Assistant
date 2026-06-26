import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { getSettings } from '../api/settings';
import { MANUAL_ACTIONS } from '../constants/manualActions';
import type { ManualAction } from '../types';
import { BASE_WINDOW_SIZE, tweenWindowSize } from '../utils/windowSize';

interface Props {
  disabled: boolean;
  onSelect: (action: ManualAction) => void;
}

export function ManualControls({ disabled, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<ManualAction[] | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSettings()
      .then((settings) => setEnabled(settings.manualActionsEnabled))
      .catch(() => setEnabled([]));
  }, []);

  useEffect(() => {
    if (!open) {
      tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height);
      return;
    }
    const extra = (gridRef.current?.scrollHeight ?? 0) + 8;
    tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height + extra);
  }, [open, enabled]);

  useEffect(() => {
    return () => {
      tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height);
    };
  }, []);

  if (!enabled) return null;

  const actions = MANUAL_ACTIONS.filter(({ action }) => enabled.includes(action));

  if (actions.length === 0) return null;

  if (actions.length === 1) {
    const { action, label, hint } = actions[0];
    return (
      <div className="manual-controls" data-tauri-drag-region>
        <button className="manual-control-button" disabled={disabled} onClick={() => onSelect(action)} title={hint}>
          {label}
        </button>
      </div>
    );
  }

  return (
    <div className="manual-controls" data-tauri-drag-region>
      <button className="manual-controls-toggle" onClick={() => setOpen((prev) => !prev)} aria-expanded={open}>
        {open ? 'Hide manual options' : 'Manual options'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="manual-controls-grid"
            ref={gridRef}
            data-tauri-drag-region
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
          >
            {actions.map(({ action, label, hint }) => (
              <button key={action} className="manual-control-button" disabled={disabled} onClick={() => onSelect(action)} title={hint}>
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
