import { AnimatePresence, motion }     from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import logoWatermark              from '../assets/logo-watermark.png';
import { CLIPBOARD_ACK_MS }       from '../constants/timing';
import type { LogLevel, LogLine } from '../types';
import { Tooltip }                from './Tooltip';

export const MARKERS: Record<LogLevel, string> = {
  ok   : 'OK',
  warn : 'WARN',
  error: 'FAILED',
  info : 'INFO',
};

interface Props {
                  lines             : LogLine[];
                  onClear           : () => void;
  emptyMessage     ?                 : string;
  onCancel         ?                 : () => void;
  defaultCollapsed ?                 : boolean;
                  onCollapsedChange?: (collapsed: boolean) => void;
}

export function LogPanel({
  lines,
  onClear,
  emptyMessage = 'Pick an option above to get started.',
  onCancel,
  defaultCollapsed = false,
  onCollapsedChange,
}: Props) {
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const prevLineCount             = useRef(lines.length);
  const [clearing, setClearing]   = useState(false);
  const [copied, setCopied]       = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lines.length]);

  useEffect(() => {
    if (lines.length > prevLineCount.current) {
      setCollapsed(false);
    }
    prevLineCount.current = lines.length;
  }, [lines.length]);

  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  const handleClear = () => setClearing(true);

  const handleCopy = async () => {
    const text = lines.map((line) => `[${MARKERS[line.level]}] ${line.message}`).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), CLIPBOARD_ACK_MS);
  };

  return (
    <div className = {`log-panel${collapsed ? ' collapsed' : ''}`} data-tauri-drag-region>
    <img className = "log-panel-watermark" src = {logoWatermark} alt = "" aria-hidden = "true" />
      <AnimatePresence>
        {onCancel && (
          <motion.button
            type       = "button"
            className  = {`log-panel-cancel${collapsed ? ' log-panel-cancel--collapsed' : ''}`}
            onClick    = {onCancel}
            initial    = {{ opacity: 0, x: -6 }}
            animate    = {{ opacity: 1, x: 0 }}
            exit       = {{ opacity: 0, x: -6 }}
            transition = {{ duration: 0.18 }}
          >
            Cancel
          </motion.button>
        )}
      </AnimatePresence>
      <div     className = "log-panel-actions">
      <Tooltip content   = {collapsed ? 'Expand console' : 'Collapse console'}>
          <button
            className     = "log-panel-collapse"
            onClick       = {() => setCollapsed((c) => !c)}
            aria-label    = {collapsed ? 'Expand console' : 'Collapse console'}
            aria-expanded = {!collapsed}
          >
            <ChevronIcon collapsed = {collapsed} />
          </button>
        </Tooltip>
        <AnimatePresence>
          {!collapsed && lines.length > 0 && (
            <motion.div
              className  = "log-panel-actions-extra"
              initial    = {{ opacity: 0, width: 0 }}
              animate    = {{ opacity: 1, width: 'auto' }}
              exit       = {{ opacity: 0, width: 0 }}
              transition = {{ duration: 0.2, ease: [0.2, 0.7, 0.3, 1] }}
            >
              <Tooltip content   = {copied ? 'Copied!' : 'Copy logs'}>
              <button  className = "log-panel-copy" onClick = {handleCopy} aria-label = "Copy logs">
                  {copied ? <CheckIcon /> : <ClipboardIcon />}
                </button>
              </Tooltip>
              <Tooltip content   = "Clear console">
              <button  className = "log-panel-clear" onClick = {handleClear} disabled = {clearing}>
                  Clear
                </button>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <motion.div
        className = "log-panel-scroll"
        role      = "status"
        aria-live = "polite"
        data-tauri-drag-region
        initial    = {false}
        animate    = {{ opacity: collapsed ? 0 : 1, y: collapsed ? -6 : 0 }}
        transition = {{ duration: collapsed ? 0.16 : 0.24, ease: [0.2, 0.7, 0.3, 1] }}
        style      = {{ pointerEvents: collapsed ? 'none' : 'auto' }}
      >
        {lines.length === 0 ? (
          <div className = "log-panel-empty" data-tauri-drag-region>
            <div data-tauri-drag-region>{emptyMessage}</div>
            <div className = "disclaimer" data-tauri-drag-region>
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
              <motion.div
                key       = "lines"
                className = "log-panel-lines"
                exit      = {{ opacity: 0, scale: 0.97, transition: { staggerChildren: 0.012, staggerDirection: -1 } }}
                data-tauri-drag-region
              >
                {lines.map((line, index) => (
                  <motion.div
                    key        = {index}
                    initial    = {{ opacity: 0, x: -6 }}
                    animate    = {{ opacity: 1, x: 0 }}
                    exit       = {{ opacity: 0, scale: 0.9, filter: 'blur(3px)', transition: { duration: 0.15, ease: 'easeIn' } }}
                    transition = {{ duration: 0.2 }}
                    className  = {`log-line log-${line.level}`}
                    data-tauri-drag-region
                  >
                    <span className = "log-marker">[{MARKERS[line.level]}]</span>
                    {line.message}
                  </motion.div>
                ))}
                <div ref = {bottomRef} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <motion.svg
      viewBox     = "0 0 24 24"
      fill        = "none"
      aria-hidden = "true"
      animate     = {{ rotate: collapsed ? 180 : 0 }}
      transition  = {{ duration: 0.22, ease: [0.2, 0.7, 0.3, 1] }}
      style       = {{ transformOrigin: 'center' }}
    >
      <path d = "M6 9l6 6 6-6" stroke = "currentColor" strokeWidth = "2" strokeLinecap = "round" strokeLinejoin = "round" />
    </motion.svg>
  );
}

function ClipboardIcon() {
  return (
    <svg  viewBox = "0 0 24 24" fill = "none" aria-hidden = "true">
    <rect x       = "8" y            = "4" width          = "8" height = "4" rx = "1" stroke = "currentColor" strokeWidth = "1.6" />
      <path
        d              = "M8 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2"
        stroke         = "currentColor"
        strokeWidth    = "1.6"
        strokeLinecap  = "round"
        strokeLinejoin = "round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg  viewBox = "0 0 24 24" fill        = "none" aria-hidden         = "true">
    <path d       = "M5 12l5 5L19 7" stroke = "currentColor" strokeWidth = "2" strokeLinecap = "round" strokeLinejoin = "round" />
    </svg>
  );
}
