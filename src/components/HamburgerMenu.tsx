import { AnimatePresence, motion }                                                       from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal }                                                                  from 'react-dom';

import type { Page } from '../types';
import { Tooltip }   from './Tooltip';

const PAGES: { id: Page; label: string }[] = [
  { id: 'automate', label: 'Automate' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'tools', label: 'Tools' },
  { id: 'configs', label: 'Configs' },
  { id: 'settings', label: 'Settings' },
];

const MENU_GAP = 6;

interface Props {
                  page        : Page;
                  onSelectPage: (page: Page) => void;
          disabled ?           : boolean;
}

export function HamburgerMenu({ page, onSelectPage, disabled }: Props) {
  const [open, setOpen]           = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const rootRef                   = useRef<HTMLDivElement>(null);
  const triggerRef                = useRef<HTMLButtonElement>(null);
  const menuRef                   = useRef<HTMLDivElement>(null);

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    const menu    = menuRef.current;
    if (!trigger || !menu) return;

    const rect       = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const openAbove  = spaceBelow < menuHeight && rect.top > menuHeight + MENU_GAP;

    setMenuStyle({
      top       : openAbove ? rect.top - menuHeight - MENU_GAP : rect.bottom + MENU_GAP,
      left      : rect.left,
      minWidth  : Math.max(rect.width, 140),
      visibility: 'visible',
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onReposition = () => positionMenu();

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReposition);
    document.addEventListener('scroll', onReposition, true);

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReposition);
      document.removeEventListener('scroll', onReposition, true);
    };
  }, [open, positionMenu]);

  return (
    <div className = "hamburger-menu" ref = {rootRef}>
      <Tooltip content = "Navigation">
        <button
          ref           = {triggerRef}
          className     = "hamburger-button"
          onClick       = {() => setOpen((prev) => !prev)}
          disabled      = {disabled}
          aria-label    = "Menu"
          aria-expanded = {open}
        >
          <HamburgerIcon open = {open} />
        </button>
      </Tooltip>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref        = {menuRef}
                className  = "hamburger-dropdown hamburger-dropdown-portal"
                style      = {menuStyle}
                initial    = {{ opacity: 0, scale: 0.9, y: -6 }}
                animate    = {{ opacity: 1, scale: 1, y: 0 }}
                exit       = {{ opacity: 0, scale: 0.92, y: -4, transition: { duration: 0.12 } }}
                transition = {{ type: 'spring', stiffness: 420, damping: 22 }}
              >
                {PAGES.map(({ id, label }, index) => (
                  <motion.button
                    key       = {id}
                    type      = "button"
                    className = {`hamburger-dropdown-item${id === page ? ' active' : ''}`}
                    initial   = {{ opacity: 0, x: -6 }}
                    animate   = {{ opacity: 1, x: 0, transition: { delay: index * 0.03 } }}
                    onClick   = {() => {
                      onSelectPage(id);
                      setOpen(false);
                    }}
                  >
                    {label}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  const lineProps = { x1: 4, x2: 20, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const };

  return (
    <svg viewBox = "0 0 24 24" fill = "none" aria-hidden = "true">
      <motion.line
        {...lineProps}
        style      = {{ originX: 0.5, originY: 0.5 }}
        animate    = {{ y1: open ? 12 : 7, y2: open ? 12 : 7, rotate: open ? 45 : 0 }}
        transition = {{ duration: 0.2, ease: 'easeInOut' }}
      />
      <motion.line {...lineProps} y1 = {12} y2 = {12} animate = {{ opacity: open ? 0 : 1 }} transition = {{ duration: 0.12 }} />
      <motion.line
        {...lineProps}
        style      = {{ originX: 0.5, originY: 0.5 }}
        animate    = {{ y1: open ? 12 : 17, y2: open ? 12 : 17, rotate: open ? -45 : 0 }}
        transition = {{ duration: 0.2, ease: 'easeInOut' }}
      />
    </svg>
  );
}