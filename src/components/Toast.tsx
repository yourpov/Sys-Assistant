import { motion, type PanInfo } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { AnimatedLink } from '@/components/ui/animated-link';
import { DynamicIsland, DynamicIslandView } from '@/components/ui/be-ui-dynamic-island';

import { useMotionPreference } from '../hooks/useMotionPreference';
import { toast, type ToastData } from '../hooks/useToastStore';

const DISMISS_THRESHOLD = 80;
const AUTO_DISMISS = 4000;
const FORM_SPRING = { type: 'spring' as const, stiffness: 420, damping: 19, mass: 0.8 };

export function Toast({ data }: { data: ToastData }) {
  const reduceMotion = useMotionPreference();
  const { icon } = data;
  const isConfirm = !!data.confirm;
  const hasDetail = !isConfirm && (!!data.body || !!data.action);
  const islandView = isConfirm ? 'confirm' : hasDetail ? 'detail' : null;
  const [alive, setAlive] = useState(true);
  const timeoutRef = useRef<number | null>(null);
  const elapsed = useRef(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (isConfirm) return;
    startRef.current = Date.now();
    timeoutRef.current = window.setTimeout(() => setAlive(false), AUTO_DISMISS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isConfirm]);

  useEffect(() => {
    if (!alive && !isConfirm) toast.dismiss(data.id);
  }, [alive, data.id, isConfirm]);

  const pause = () => {
    if (isConfirm) return;
    elapsed.current += Date.now() - startRef.current;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const resume = () => {
    if (isConfirm) return;
    startRef.current = Date.now();
    timeoutRef.current = window.setTimeout(() => setAlive(false), Math.max(0, AUTO_DISMISS - elapsed.current));
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (isConfirm) return;
    if (Math.abs(info.offset.y) > DISMISS_THRESHOLD) setAlive(false);
  };

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.4 }}
      animate={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 1, y: 0, scale: 1, transition: FORM_SPRING }}
      exit={reduceMotion ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -6, scale: 0.5, transition: { duration: 0.16, ease: 'easeIn' } }}
      drag={reduceMotion || isConfirm ? false : 'y'}
      dragElastic={0.3}
      dragConstraints={{ top: 0, bottom: 0 }}
      onDragEnd={onDragEnd}
      onPointerEnter={pause}
      onPointerLeave={resume}
      className={isConfirm ? 'toast toast--confirm' : 'toast'}
    >
      <DynamicIsland
        view={islandView}
        noise
        shape={isConfirm ? 'card' : 'pill'}
        className={isConfirm ? 'toast-island toast-island-confirm' : 'toast-island'}
        compact={
          <div className="toast-island-compact-row">
            <ToastIcon icon={icon} />
            <span className="toast-title">{data.title}</span>
          </div>
        }
      >
        {hasDetail ? (
          <DynamicIslandView id="detail" className="toast-island-pill-view">
            <div className="toast-island-head">
              <ToastIcon icon={icon} />
              <div className="toast-island-copy">
                <span className="toast-title">{data.title}</span>
                {data.body ? <p className="toast-message">{data.body}</p> : null}
              </div>
            </div>

            {data.action ? (
              <AnimatedLink
                variant="left"
                showArrow
                className="toast-action"
                onClick={() => {
                  data.action!.fn();
                  setAlive(false);
                }}
              >
                {data.action.label}
              </AnimatedLink>
            ) : null}
          </DynamicIslandView>
        ) : null}

        {isConfirm ? (
          <DynamicIslandView id="confirm" className="toast-island-confirm-view">
            <div className="toast-confirm-header">
              <div className="toast-confirm-leading">
                <ToastIcon icon={icon} />
              </div>
              <div className="toast-confirm-copy">
                <p className="toast-confirm-title">{data.title}</p>
                {data.body ? <p className="toast-confirm-message">{data.body}</p> : null}
              </div>
              <button
                type="button"
                className="toast-close toast-confirm-close"
                onClick={() => toast.respond(data.id, false)}
                aria-label="Dismiss"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="toast-confirm-actions">
              <button
                type="button"
                className={`toast-confirm-button ${icon === 'error' ? 'toast-confirm-danger' : 'toast-confirm-warning'}`}
                onClick={() => toast.respond(data.id, true)}
              >
                {data.confirm!.confirmLabel}
              </button>
              <button type="button" className="toast-cancel-button" onClick={() => toast.respond(data.id, false)}>
                {data.confirm!.cancelLabel}
              </button>
            </div>
          </DynamicIslandView>
        ) : null}
      </DynamicIsland>
    </motion.div>
  );
}

function ToastIcon({ icon }: { icon: ToastData['icon'] }) {
  const className = `toast-icon toast-icon-${icon}`;
  if (icon === 'success') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === 'error') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M9 9L15 15M15 9L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === 'warning') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3L22 20H2L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 10V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8V8.01M12 11V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}