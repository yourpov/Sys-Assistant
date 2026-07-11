import { useEffect, useState, type PointerEvent, type ReactNode } from 'react';

const EXPANDABLE_STATE_KEY = 'automate-expandable-state';

function loadOpen(sectionId: string, defaultOpen: boolean): boolean {
  try {
    const raw = sessionStorage.getItem(EXPANDABLE_STATE_KEY);
    if (!raw) return defaultOpen;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return sectionId in parsed ? parsed[sectionId]: defaultOpen;
  } catch {
    return defaultOpen;
  }
}

function saveOpen(sectionId: string, open: boolean) {
  try {
    const raw         = sessionStorage.getItem(EXPANDABLE_STATE_KEY);
    const parsed      = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[sectionId] = open;
    sessionStorage.setItem(EXPANDABLE_STATE_KEY, JSON.stringify(parsed));
  } catch {
  }
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className   = "automate-expandable__chevron"
      viewBox     = "0 0 24 24"
      fill        = "none"
      aria-hidden = "true"
      style       = {{ transform: expanded ? 'rotate(180deg)' : 'none' }}
    >
      <path d = "M6 9l6 6 6-6" stroke = "currentColor" strokeWidth = "2" strokeLinecap = "round" strokeLinejoin = "round" />
    </svg>
  );
}

interface AutomateExpandableProps {
              sectionId    : string;
              title        : string;
  hint        ?            : string;
  defaultOpen ?            : boolean;
  persist     ?            : boolean;
  disabled    ?            : boolean;
              onOpenChange?: (open: boolean) => void;
  className   ?            : string;
              children     : ReactNode;
}

export function AutomateExpandable({
  sectionId,
  title,
  hint,
  defaultOpen = false,
  persist     = false,
  disabled    = false,
  onOpenChange,
  className,
  children,
}: AutomateExpandableProps) {
  const [open, setOpen] = useState(() => (persist ? loadOpen(sectionId, defaultOpen) : defaultOpen));

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const toggle = () => {
    if (disabled) return;
    setOpen((prev) => {
      const next = !prev;
      if (persist) saveOpen(sectionId, next);
      return next;
    });
  };

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  const panelClass = [
    'automate-expandable',
    open ? 'automate-expandable--open': 'automate-expandable--collapsed',
    disabled && 'automate-expandable--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className = {panelClass} data-section-id = {sectionId} data-tauri-drag-region>
      <button
        type          = "button"
        className     = "automate-expandable__toggle"
        onPointerDown = {handlePointerDown}
        onClick       = {(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-expanded = {open}
        disabled      = {disabled}
      >
        <span className = "automate-expandable__head" data-tauri-drag-region>
        <span className = "automate-expandable__title">{title}</span>
          {hint ? <p className="automate-expandable__hint">{hint}</p> : null}
        </span>
        <Chevron expanded = {open} />
      </button>
      <div className = "automate-expandable__body" aria-hidden = {!open}>
      <div className = "automate-expandable__inner drag-surface">{children}</div>
      </div>
    </section>
  );
}