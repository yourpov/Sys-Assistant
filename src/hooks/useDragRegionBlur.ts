import { useEffect } from 'react';

export function useDragRegionBlur() {
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active === target) return;
      if (target?.closest('[data-tauri-drag-region]') && !target.closest('input, textarea, select, button')) {
        active.blur();
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, []);
}
