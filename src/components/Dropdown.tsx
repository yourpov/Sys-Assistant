import { AnimatePresence, motion }                                                       from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal }                                                                  from 'react-dom';

export interface DropdownOption {
  value: string;
  label: string;
}

interface Props {
              value         : string;
              options       : DropdownOption[];
              onChange      : (value: string) => void;
  placeholder ?             : string;
  className   ?             : string;
              menuClassName?: string;
}

const MENU_GAP = 6;

export function Dropdown({ value, options, onChange, placeholder, className, menuClassName }: Props) {
  const [open, setOpen]           = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const rootRef                   = useRef<HTMLDivElement>(null);
  const triggerRef                = useRef<HTMLButtonElement>(null);
  const menuRef                   = useRef<HTMLDivElement>(null);
  const selected                  = options.find((o) => o.value === value);

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    const menu    = menuRef.current;
    if (!trigger || !menu) return;

    const rect       = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const openAbove  = spaceBelow < menuHeight && rect.top > menuHeight + MENU_GAP;

    setMenuStyle({
      top       : openAbove ? rect.top - menuHeight - MENU_GAP: rect.bottom + MENU_GAP,
      left      : rect.left,
      width     : rect.width,
      visibility: 'visible',
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
  }, [open, options, positionMenu]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
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
    <div className = {`dropdown${className ? ` ${className}` : ''}`} ref = {rootRef}>
      <button
        ref           = {triggerRef}
        type          = "button"
        className     = "dropdown-trigger"
        onClick       = {() => setOpen((o) => !o)}
        aria-expanded = {open}
      >
        <span className = {selected ? '' : 'dropdown-placeholder'}>{selected?.label ?? placeholder ?? 'Select...'}</span>
        <svg  className = "dropdown-caret" viewBox = "0 0 24 24" fill           = "none" aria-hidden = "true">
        <path d         = "M6 9l6 6 6-6" stroke    = "currentColor" strokeWidth = "2" strokeLinecap  = "round" strokeLinejoin = "round" />
        </svg>
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref        = {menuRef}
                className  = {`dropdown-menu dropdown-menu-portal${menuClassName ? ` ${menuClassName}` : ''}`}
                style      = {menuStyle}
                initial    = {{ opacity: 0, y: -4 }}
                animate    = {{ opacity: 1, y: 0 }}
                exit       = {{ opacity: 0, y: -4 }}
                transition = {{ duration: 0.12 }}
              >
                {options.map((option) => (
                  <button
                    key       = {option.value}
                    type      = "button"
                    className = {`dropdown-option${option.value === value ? ' active' : ''}`}
                    onClick   = {() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}