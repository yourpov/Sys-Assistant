import type { ReactNode } from 'react';

interface AutomateSectionProps {
            title      : string;
  hint      ?          : string;
  footer    ?          : ReactNode;
            scrollable?: boolean;
  fill      ?          : boolean;
  className ?          : string;
            children   : ReactNode;
}

export function AutomateSection({
  title,
  hint,
  footer,
  scrollable = false,
  fill       = false,
  className,
  children,
}: AutomateSectionProps) {
  const sectionClass = [
    'surface-card',
    'automate-panel',
    fill && 'automate-panel--fill',
    scrollable && 'automate-panel--scrollable',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const bodyClass = ['automate-panel__body', scrollable && 'automate-panel__body--scroll'].filter(Boolean).join(' ');

  return (
    <section className = {sectionClass} data-tauri-drag-region>
    <header  className = "automate-panel__head" data-tauri-drag-region>
    <h3      className = "automate-panel__title">{title}</h3>
        {hint ? <p className="automate-panel__hint">{hint}</p> : null}
      </header>
      <div className = {bodyClass} data-tauri-drag-region>
        {children}
      </div>
      {footer ? (
        <footer className = "automate-panel__foot" data-tauri-drag-region>
          {footer}
        </footer>
      ) : null}
    </section>
  );
}