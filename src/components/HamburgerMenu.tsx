import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import type { Page } from '../types';

const PAGES: { id: Page; label: string }[] = [
  { id: 'automate', label: 'Automate' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'tools', label: 'Tools' },
  { id: 'configs', label: 'Configs' },
  { id: 'changelogs', label: 'Changelogs' },
  { id: 'settings', label: 'Settings' },
];

interface Props {
  page: Page;
  onSelectPage: (page: Page) => void;
  disabled?: boolean;
}

export function HamburgerMenu({ page, onSelectPage, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="hamburger-menu" ref={ref}>
      <button
        className="hamburger-button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-label="Menu"
        aria-expanded={open}
      >
        <HamburgerIcon />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="hamburger-dropdown"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
          >
            {PAGES.map(({ id, label }) => (
              <button
                key={id}
                className={`hamburger-dropdown-item${id === page ? ' active' : ''}`}
                onClick={() => {
                  onSelectPage(id);
                  setOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
