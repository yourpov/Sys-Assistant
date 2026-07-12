import { AnimatePresence, motion }                                                       from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal }                                                                  from 'react-dom';

interface Props {
              value       : string;
              onChange    : (value: string) => void;
              options     : string[];
  placeholder ?           : string;
  autoFocus   ?           : boolean;
}

const MENU_GAP = 6;

export function Autocomplete({ value, onChange, options, placeholder, autoFocus }: Props) {
  const [open, setOpen]           = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const rootRef                   = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const menuRef                   = useRef<HTMLDivElement>(null);

  const query    = value.trim().toLowerCase();
  const filtered = query
    ? options.filter((option) => option.toLowerCase().includes(query) && option.toLowerCase() !== query)
    : options;

  const positionMenu = useCallback(() => {
    const input = inputRef.current;
    const menu  = menuRef.current;
    if (!input || !menu) return;

    const rect       = input.getBoundingClientRect();
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
  }, [open, filtered.length, positionMenu]);

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
    <div className = "autocomplete" ref = {rootRef}>
      <input
        ref          = {inputRef}
        type         = "text"
        role         = "combobox"
        aria-expanded= {open}
        aria-autocomplete = "list"
        autoComplete = "off"
        value        = {value}
        onChange     = {(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus      = {() => setOpen(true)}
        placeholder  = {placeholder}
        autoFocus    = {autoFocus}
      />

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && filtered.length > 0 && (
              <motion.div
                ref        = {menuRef}
                role       = "listbox"
                className  = "dropdown-menu dropdown-menu-portal"
                style      = {menuStyle}
                initial    = {{ opacity: 0, y: -4 }}
                animate    = {{ opacity: 1, y: 0 }}
                exit       = {{ opacity: 0, y: -4 }}
                transition = {{ duration: 0.12 }}
              >
                {filtered.map((option) => (
                  <button
                    key         = {option}
                    type        = "button"
                    role        = "option"
                    className   = "dropdown-option"
                    onMouseDown = {(e) => e.preventDefault()}
                    onClick     = {() => {
                      onChange(option);
                      setOpen(false);
                    }}
                  >
                    {option}
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
