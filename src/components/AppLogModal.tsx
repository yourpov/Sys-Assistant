import { motion }                                            from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal }                                      from 'react-dom';

import { clearAppLog, readAppLog } from '../api/applog';
import { parseInvokeError, toastFromError, type UserFacingError } from '../utils/userError';
import { ErrorDisplay } from './ErrorDisplay';
import { CLIPBOARD_ACK_MS }        from '../constants/timing';
import { toast }                   from '../hooks/useToastStore';
import { MARKERS }                 from './LogPanel';
import { Tooltip }                 from './Tooltip';
import type { LogLevel }           from '../types';

type Filter = 'all' | LogLevel;

const FILTERS: Filter[] = ['all', 'ok', 'warn', 'error', 'info'];
const LOG_LINE_PATTERN  = /^\[(\d{2}:\d{2}:\d{2})\] (\w+) (.*)$/;
const REFRESH_MS = 1000;

interface ParsedLine {
  time   : string;
  level  : LogLevel;
  message: string;
  raw    : string;
}

function parseLevel(level: string): LogLevel {
  return level in MARKERS ? (level as LogLevel): 'info';
}

function parseLines(raw: string): ParsedLine[] {
  return raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const match = LOG_LINE_PATTERN.exec(line);
      if (!match) {
        return { time: '', level: 'info' as LogLevel, message: line, raw: line };
      }
      const [, time, level, message] = match;
      return { time, level: parseLevel(level), message, raw: line };
    });
}

interface Props {
  onClose: () => void;
}

export function AppLogModal({ onClose }: Props) {
  const [raw, setRaw]             = useState<string | null>(null);
  const [loadError, setLoadError] = useState<UserFacingError | null>(null);
  const [filter, setFilter]       = useState<Filter>('all');
  const [copied, setCopied]       = useState(false);
  const bodyRef                   = useRef<HTMLDivElement>(null);
  const stickToBottomRef          = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await readAppLog();
      setRaw(next);
      setLoadError(null);
    } catch (err) {
      setLoadError(parseInvokeError(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const previousOverflow             = document.body.style.overflow;
          document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const lines   = useMemo(() => (raw ? parseLines(raw) : []), [raw]);
  const visible = filter === 'all' ? lines : lines.filter((line) => line.level === filter);

  useEffect(() => {
    if (!stickToBottomRef.current || !bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [visible.length, raw]);

  const handleScroll = () => {
    const node = bodyRef.current;
    if (!node) return;
    const distanceFromBottom       = node.scrollHeight - node.scrollTop - node.clientHeight;
          stickToBottomRef.current = distanceFromBottom < 48;
  };

  const copy = async () => {
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), CLIPBOARD_ACK_MS);
    } catch (err) {
      toast.error({
        title: "Your logs couldn't be copied",
        body : 'Allow clipboard access in your browser settings, then try again.',
      });
    }
  };

  const clear = async () => {
    try {
      await clearAppLog();
      setRaw('');
      setLoadError(null);
    } catch (err) {
      toast.error(toastFromError(err, { title: "Your logs couldn't be cleared" }));
    }
  };

  return createPortal(
    <motion.div
      className = "dialog-backdrop app-log-backdrop"
      data-tauri-drag-region
      onClick    = {onClose}
      initial    = {{ opacity: 0 }}
      animate    = {{ opacity: 1 }}
      exit       = {{ opacity: 0 }}
      transition = {{ duration: 0.16 }}
    >
      <motion.div
        className       = "dialog app-log-dialog"
        role            = "dialog"
        aria-modal      = "true"
        aria-labelledby = "app-log-title"
        onClick         = {(e) => e.stopPropagation()}
        initial         = {{ opacity: 0, scale: 0.94, y: 8 }}
        animate         = {{ opacity: 1, scale: 1, y: 0 }}
        exit            = {{ opacity: 0, scale: 0.94, y: 8 }}
        transition      = {{ duration: 0.18, ease: [0.2, 0.9, 0.3, 1.2] }}
      >
        <div className = "dialog-heading app-log-heading">
        <h2  id        = "app-log-title">Developer logs</h2>
        <div className = "app-tab-bar app-tab-bar--inline app-tab-bar--compact app-tab-bar--cols-5 app-log-filters" role = "tablist">
            {FILTERS.map((f) => (
              <button
                key           = {f}
                type          = "button"
                role          = "tab"
                aria-selected = {f === filter}
                className     = {`app-tab-button${f === filter ? ' active' : ''}`}
                onClick       = {() => setFilter(f)}
              >
                {f === 'all' ? 'All' : MARKERS[f]}
              </button>
            ))}
          </div>
        </div>
        <p className = "settings-hint app-log-hint">logs for this session only. Refreshes while this window is open.</p>

        <div ref = {bodyRef} className = "app-log-body" onScroll = {handleScroll}>
          {loadError ? (
            <ErrorDisplay error = {loadError} className = "app-log-empty app-log-error" onRetry = {() => void refresh()} />
          )  : raw     === null ? (
          <p className          = "app-log-empty">Loading...</p>
          )  : visible.length === 0 ? (
            <p className = "app-log-empty">Nothing logged yet. Errors from toasts and failed loads appear here.</p>
          ) : (
            visible.map((line, i) => (
              <div  key       = {`${line.raw}-${i}`} className = {`log-line log-${line.level}`}>
              <span className = "log-marker app-log-marker">
                  {line.time ? `[${line.time}] [${MARKERS[line.level]}]` : `[${MARKERS[line.level]}]`}
                </span>
                <span className = "app-log-message">{line.message}</span>
              </div>
            ))
          )}
        </div>

        <div     className = "dialog-actions">
        <Tooltip content   = "Clear developer logs">
        <button  type      = "button" className = "dialog-cancel" onClick = {() => void clear()} disabled = {!lines.length}>
              Clear
            </button>
          </Tooltip>
          <Tooltip content = {copied ? 'Copied!' : 'Copy developer logs'}>
          <button  type    = "button" className = "dialog-cancel" onClick = {() => void copy()} disabled = {!lines.length}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </Tooltip>
          <button type = "button" className = "dialog-confirm" onClick = {onClose} autoFocus>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}