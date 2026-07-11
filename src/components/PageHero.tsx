import type { ReactNode } from 'react';

interface Props {
  title       : string;
  subtitle ?  : string;
  actions  ?  : ReactNode;
  className?  : string;
}

export function PageHero({ title, subtitle, actions, className }: Props) {
  return (
    <div className = {`page-hero${className ? ` ${className}` : ''}`} data-tauri-drag-region>
      <div className = "page-hero-text" data-tauri-drag-region>
        <h2 className = "page-hero-title">{title}</h2>
        {subtitle && <p className="page-hero-subtitle">{subtitle}</p>}
      </div>
      {actions && (
        <div className = "page-hero-actions drag-surface" data-tauri-drag-region>
          {actions}
        </div>
      )}
    </div>
  );
}