import { useEffect } from 'react';

import { DRAG_SURFACE_DEBOUNCE_MS } from '../constants/timing';

const DRAG_SURFACE_SELECTOR = [
  '.page-fade',
  '.app-tab-panel',
  '.tools-stack',
  '.tools-panel-body',
  '.tools-content',
  '.collection-tool',
  '.collection-shell',
  '.collection-topbar',
  '.collection-topbar-copy',
  '.collection-workspace',
  '.collection-category-rail',
  '.collection-stage',
  '.collection-guns-layout',
  '.collection-guns-main',
  '.collection-preview-panel',
  '.collection-preview-art',
  '.collection-preview-meta',
  '.collection-skin-strip-wrap',
  '.collection-items-layout',
  '.collection-detail-panel',
  '.collection-detail-art',
  '.collection-detail-meta',
  '.configs-detail-panel',
  '.configs-detail-topbar',
  '.configs-feed',
  '.configs-feed-header',
  '.configs-feed-title',
  '.configs-type-filters',
  '.configs-share-view',
  '.configs-share-scroll',
  '.configs-share-body',
  '.configs-share-view-header',
  '.configs-publish-preview',
  '.settings-content',
  '.settings-panel',
  '.settings-panel-body',
  '.settings-panel-hint',
  '.settings-panel-title',
  '.settings-actions-row',
  '.settings-group-body',
  '.settings-group-stack',
  '.settings-toggle-stack',
  '.account-swap-list',
  '.account-swap-empty',
  '.account-swap-toolbar',
  '.account-swap-bulk-bar',
  '.automate-workspace',
  '.automate-panels',
  '.automate-panel',
  '.automate-panel__head',
  '.automate-panel__foot',
  '.automate-expandable',
  '.automate-expandable__head',
  '.accounts-content',
  '.account-controls',
  '.skeleton',
  '.skeleton-section',
  '.tools-empty',
  '.tools-live-pills',
  '.tools-meta-block',
  '.tools-version-split-pill',
  '.tools-match-toolbar',
  '.tools-match-meta',
  '.tools-subsection-bar',
  '.page-hero-actions',
  '.page-hero-subtitle',
  '.app-tab-bar',
  '.settings-error',
  '.settings-hint',
  '.tools-stat',
  '.tools-overview',
  '.tools-panel-hint',
  '.tools-panel-title',
  '.monitor-last-check',
  '.configs-tab-panel',
  '.drag-surface',
].join(',');

function isInteractiveSurface(el: Element): boolean {
  return el.matches(
    'button, input, textarea, select, a, [role="button"], .dropdown-trigger, .dropdown-option, .tools-match-line, .configs-feed-card, .account-row, .collection-weapon-btn, .collection-skin-tile, .collection-item-tile, .collection-category-btn',
  );
}

function applyDragSurfaces() {
  document.querySelectorAll(DRAG_SURFACE_SELECTOR).forEach((el) => {
    if (!(el instanceof HTMLElement) || isInteractiveSurface(el)) return;
    el.setAttribute('data-tauri-drag-region', '');
  });
}

export function useDragSurfaces() {
  useEffect(() => {
    const schedule = () => {
      applyDragSurfaces();
      requestAnimationFrame(applyDragSurfaces);
    };

    schedule();

    let debounce: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(schedule, DRAG_SURFACE_DEBOUNCE_MS);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (debounce) clearTimeout(debounce);
      observer.disconnect();
    };
  }, []);
}