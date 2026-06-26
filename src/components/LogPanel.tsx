import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import logoWatermark from '../assets/logo-watermark.png';
import type { LogLevel, LogLine } from '../types';

const MARKERS: Record<LogLevel, string> = {
  ok: 'OK',
  warn: 'WARN',
  error: 'FAILED',
  info: 'INFO',
};

interface Props {
  lines: LogLine[];
  onClear: () => void;
  emptyMessage?: string;
  onCancel?: () => void;
}

export function LogPanel({ lines, onClear, emptyMessage = 'Pick an option above to get started.', onCancel }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lines.length]);

  const handleClear = () => setClearing(true);

  return (
    <div className="log-panel" data-tauri-drag-region>
      <img className="log-panel-watermark" src={logoWatermark} alt="" aria-hidden="true" />
      {onCancel && (
        <button className="log-panel-cancel" onClick={onCancel}>
          Cancel
        </button>
      )}
      {lines.length > 0 && (
        <button className="log-panel-clear" onClick={handleClear} disabled={clearing}>
          Clear
        </button>
      )}
      <div className="log-panel-scroll" role="status" aria-live="polite" data-tauri-drag-region>
        {lines.length === 0 ? (
          <div className="log-panel-empty" data-tauri-drag-region>
            <div data-tauri-drag-region>{emptyMessage}</div>
            <div className="disclaimer" data-tauri-drag-region>
              Not an official product of Sys-Info
            </div>
          </div>
        ) : (
          <AnimatePresence
            onExitComplete={() => {
              onClear();
              setClearing(false);
            }}
          >
            {!clearing && (
              <motion.div key="lines" className="log-panel-lines" exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }} data-tauri-drag-region>
                {lines.map((line, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`log-line log-${line.level}`}
                    data-tauri-drag-region
                  >
                    <span className="log-marker">[{MARKERS[line.level]}]</span>
                    {line.message}
                  </motion.div>
                ))}
                <div ref={bottomRef} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
