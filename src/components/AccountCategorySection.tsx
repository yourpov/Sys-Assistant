import { Reorder, useDragControls } from 'framer-motion';
import { useEffect, useState, type ReactNode, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';

import { Tooltip } from './Tooltip';

function CategoryChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className   = "account-category-chevron"
      viewBox     = "0 0 24 24"
      fill        = "none"
      aria-hidden = "true"
      style       = {{ transform: expanded ? 'rotate(180deg)' : 'none' }}
    >
      <path d = "M6 9l6 6 6-6" stroke = "currentColor" strokeWidth = "2" strokeLinecap = "round" strokeLinejoin = "round" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg    viewBox = "0 0 16 16" fill = "currentColor" aria-hidden = "true">
    <circle cx      = "5" cy           = "3" r                      = "1.25" />
    <circle cx      = "11" cy          = "3" r                      = "1.25" />
    <circle cx      = "5" cy           = "8" r                      = "1.25" />
    <circle cx      = "11" cy          = "8" r                      = "1.25" />
    <circle cx      = "5" cy           = "13" r                     = "1.25" />
    <circle cx      = "11" cy          = "13" r                     = "1.25" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox = "0 0 24 24" fill = "none" aria-hidden = "true">
      <path
        d              = "M4 20l3.5-.8L18.6 8.1a1.6 1.6 0 0 0 0-2.3l-1.4-1.4a1.6 1.6 0 0 0-2.3 0L3.8 15.5 3 19z"
        stroke         = "currentColor"
        strokeWidth    = "1.6"
        strokeLinejoin = "round"
        strokeLinecap  = "round"
      />
    </svg>
  );
}

interface Props {
              categoryKey    : string;
              title          : string;
              count          : number;
              open           : boolean;
              forceOpen      : boolean;
              compact        : boolean;
              reorderable    : boolean;
              reorderEnabled : boolean;
              searchActive   : boolean;
              onToggle       : () => void;
              onRename       : (newTitle: string) => void;
              onReorderDragEnd?: () => void;
              children       : ReactNode;
}

export function AccountCategorySection({
  categoryKey,
  title,
  count,
  open,
  forceOpen,
  compact,
  reorderable,
  reorderEnabled,
  searchActive,
  onToggle,
  onRename,
  onReorderDragEnd,
  children,
}: Props) {
  const dragControls            = useDragControls();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft]       = useState(title);

  useEffect(() => {
    if (!renaming) setDraft(title);
  }, [title, renaming]);

  const stop = (e: ReactPointerEvent<HTMLButtonElement> | ReactMouseEvent<HTMLButtonElement>) => e.stopPropagation();

  const startRename = () => {
    setDraft(title);
    setRenaming(true);
  };

  const commitRename = () => {
    setRenaming(false);
    const trimmed = draft.trim();
    if (trimmed !== '' && trimmed !== title) onRename(trimmed);
  };

  const cancelRename = () => {
    setRenaming(false);
    setDraft(title);
  };

  const dragHandle = reorderable ? (
    <Tooltip content = {reorderEnabled ? 'Drag to reorder' : searchActive ? 'Clear search to reorder' : 'Reorder unavailable right now'}>
      <button
        type       = "button"
        className  = {`account-category-drag-handle${reorderEnabled ? '' : ' account-category-drag-handle--locked'}`}
        disabled   = {!reorderEnabled}
        aria-label = {reorderEnabled ? 'Drag to reorder' : 'Reorder unavailable'}
        onPointerDown = {(event) => {
          if (!reorderEnabled) return;
          event.preventDefault();
          dragControls.start(event);
        }}
      >
        <GripIcon />
      </button>
    </Tooltip>
  ) : null;

  const toggleButton = (
    <button
      type          = "button"
      className     = {`account-category-toggle${forceOpen ? ' account-category-toggle--locked' : ''}`}
      onPointerDown = {stop}
      onClick       = {(e) => {
        stop(e);
        if (!forceOpen) onToggle();
      }}
      disabled      = {forceOpen}
      aria-expanded = {open}
    >
      <CategoryChevron expanded = {open} />
    </button>
  );

  const content = (
    <section className = {`account-category${open ? ' account-category--open' : ' account-category--collapsed'}${compact ? ' account-category--compact' : ''}`}>
      <div className = "account-category-header">
        {dragHandle}
        {forceOpen ? <Tooltip content = "Clear search to collapse">{toggleButton}</Tooltip> : toggleButton}

        {renaming ? (
          <input
            type          = "text"
            className     = "account-category-rename-input"
            value         = {draft}
            autoFocus
            onChange      = {(e) => setDraft(e.target.value)}
            onBlur        = {commitRename}
            onPointerDown = {(e) => e.stopPropagation()}
            onClick       = {(e) => e.stopPropagation()}
            onKeyDown     = {(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') cancelRename();
            }}
          />
        ) : (
          <button type = "button" className = "account-category-title-btn" onPointerDown = {stop} onClick = {(e) => { stop(e); onToggle(); }}>
            <span className = "account-category-title">{title}</span>
            <span className = "account-category-count">{count}</span>
          </button>
        )}

        {reorderable && !renaming && (
          <Tooltip content = "Rename category">
            <button type = "button" className = "account-category-rename-trigger" onPointerDown = {stop} onClick = {(e) => { stop(e); startRename(); }}>
              <PencilIcon />
            </button>
          </Tooltip>
        )}
      </div>
      <div className = "account-category-body" aria-hidden = {!open}>
        {children}
      </div>
    </section>
  );

  if (!reorderable) return content;

  return (
    <Reorder.Item
      as           = "div"
      value        = {categoryKey}
      dragListener = {false}
      dragControls = {dragControls}
      drag         = {reorderEnabled ? 'y' : false}
      onDragEnd    = {() => {
        if (reorderEnabled) onReorderDragEnd?.();
      }}
    >
      {content}
    </Reorder.Item>
  );
}
