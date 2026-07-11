import { getVersion }                            from '@tauri-apps/api/app';
import { getCurrentWindow }                      from '@tauri-apps/api/window';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { useEffect, useRef, useState }           from 'react';

import { useMotionPreference } from '../hooks/useMotionPreference';
import { toast, useToastStore } from '../hooks/useToastStore';
import type { Page }            from '../types';
import { logSilentFailure }     from '../utils/silentError';
import { HamburgerMenu }        from './HamburgerMenu';
import { NotificationCenter }   from './NotificationCenter';
import { Tooltip }              from './Tooltip';

const appWindow = getCurrentWindow();

const SHAKE_KEYFRAMES = {
  rotate    : [-12, 12, -10, 10, -6, 6, 0],
  transition: { duration: 0.5, ease: 'easeInOut' as const },
};

interface Props {
              page        : Page;
              onSelectPage: (page: Page) => void;
  navDisabled ?           : boolean;
}

export function Titlebar({ page, onSelectPage, navDisabled }: Props) {
  const [version, setVersion]  = useState<string | null>(null);
  const { unread, lastPushId } = useToastStore();
  const reduceMotion           = useMotionPreference();
  const bellControls           = useAnimation();
  const prevPushId             = useRef<string | null>(null);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch((e) => logSilentFailure('titlebar.version', e));
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    if (lastPushId && lastPushId !== prevPushId.current) {
      prevPushId.current = lastPushId;
      bellControls.start(SHAKE_KEYFRAMES);
    }
  }, [lastPushId, bellControls, reduceMotion]);

  return (
    <div           className = "titlebar" data-tauri-drag-region>
    <div           className = "titlebar-left" data-tauri-drag-region>
    <HamburgerMenu page      = {page} onSelectPage = {onSelectPage} disabled = {navDisabled} />
    <span          className = "titlebar-title" data-tauri-drag-region>
          Private Assistant
        </span>
        {version && (
          <span className = "titlebar-version" data-tauri-drag-region>
            v{version}
          </span>
        )}
      </div>
      <div        className = "titlebar-controls">
      <Tooltip    content   = "Notifications">
      <button     onClick   = {toast.toggle} aria-label = "Notifications" className = "titlebar-bell">
      <motion.div animate   = {bellControls} style      = {{ originY: 0.15 }}>
      <svg        viewBox   = "0 0 24 24" fill          = "none" aria-hidden        = "true">
                <path
                  d              = "M18 9.6V9a6 6 0 1 0-12 0v.6c0 .8-.23 1.58-.67 2.25L4 14.5c-.6.92.06 2.5 1.2 2.5h13.6c1.14 0 1.8-1.58 1.2-2.5l-1.33-2.65A4.13 4.13 0 0 1 18 9.6Z"
                  stroke         = "currentColor"
                  strokeWidth    = "1.6"
                  strokeLinejoin = "round"
                />
                <path d = "M9.5 19a2.5 2.5 0 0 0 5 0" stroke = "currentColor" strokeWidth = "1.6" strokeLinecap = "round" />
              </svg>
            </motion.div>
            <AnimatePresence>
              {unread > 0 && (
                <motion.span
                  key        = "badge"
                  initial    = {{ scale: 0, opacity: 0 }}
                  animate    = {{ scale: 1, opacity: 1 }}
                  exit       = {{ scale: 0, opacity: 0 }}
                  transition = {{ type: 'spring', stiffness: 500, damping: 25 }}
                  className  = "titlebar-bell-badge"
                >
                  {unread > 99 ? '99+' : unread}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </Tooltip>
        <Tooltip content = "Minimize">
        <button  onClick = {() => appWindow.minimize()} aria-label = "Minimize">
            &minus;
          </button>
        </Tooltip>
        <Tooltip content = "Close">
        <button  onClick = {() => appWindow.close()} aria-label = "Close">
            &times;
          </button>
        </Tooltip>
      </div>
      <NotificationCenter />
    </div>
  );
}
