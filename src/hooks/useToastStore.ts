import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { useSyncExternalStore }                                     from 'react';

import { appendAppLog } from '../api/applog';
import type { LogLevel } from '../types';

export type ToastIcon = 'success' | 'error' | 'warning' | 'info';

export interface NotificationContent {
  title     : string;
  body ?    : string;
  icon ?    : ToastIcon;
}

export interface ToastDecision {
  label   : string;
  accepted: boolean;
}

export interface ToastData {
          id       : string;
          icon     : ToastIcon;
          title    : string;
          body     : string;
          timestamp: Date;
          read     : boolean;
  action   ?       : { label: string; fn: () => void };
  confirm  ?       : { resolve: (value: boolean) => void; confirmLabel: string; cancelLabel: string };
  decision ?       : ToastDecision;
}

export interface ConfirmOptions {
  icon        ?            : ToastIcon;
              confirmLabel?: string;
  cancelLabel ?            : string;
}

const MAX_VISIBLE  = 3;
const MAX_ARCHIVED = 50;

let osNotify = false;
export function setOsNotifications(enabled: boolean) {
  osNotify = enabled;
}

interface Store {
  active    : ToastData[];
  archived  : ToastData[];
  unread    : number;
  open      : boolean;
  lastPushId: string | null;
}

let   store: Store = { active: [], archived: [], unread: 0, open: false, lastPushId: null };
const listeners    = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}
function snapshot() {
  return store;
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function toastIconToLogLevel(icon: ToastIcon): LogLevel {
  switch (icon) {
    case 'success':
      return 'ok';
    case 'error':
      return 'error';
    case 'warning':
      return 'warn';
    case 'info':
      return 'info';
  }
}

function formatToastMessage(title: string, body: string): string {
  const trimmed = body.trim();
  return trimmed ? `${title}. ${trimmed}` : title;
}

function logToastToDevLog(icon: ToastIcon, title: string, body: string) {
  void appendAppLog(toastIconToLogLevel(icon), formatToastMessage(title, body)).catch(() => {});
}

function enqueue(toast: ToastData) {
  const combined = [...store.active, toast];
  const overflow = combined.length > MAX_VISIBLE ? combined.slice(0, combined.length - MAX_VISIBLE) : [];
  const archived = [...store.archived, ...overflow].slice(-MAX_ARCHIVED);
  return { combined, archived };
}

function push(content: NotificationContent, action?: { label: string; fn: () => void }) {
  const { title, body = '', icon = 'success' } = content;
  const t: ToastData                           = { id: crypto.randomUUID(), icon, title, body, timestamp: new Date(), read: false, action };

  if (osNotify) void fireOsNotification(title, body);
  logToastToDevLog(icon, title, body);

  const { combined, archived } = enqueue(t);
  const unread                 = store.open ? store.unread : store.unread + 1;
        store                  = { ...store, active: combined.slice(-MAX_VISIBLE), archived, unread, lastPushId: t.id };
  emit();
  return t.id;
}

async function fireOsNotification(title: string, body: string) {
  try {
    let granted            = await isPermissionGranted();
    if  (!granted) granted = (await requestPermission()) === 'granted';
    if (granted) sendNotification({ title, body });
  } catch {
  }
}

function archive(t: ToastData) {
  store = { ...store, archived: [...store.archived, t].slice(-MAX_ARCHIVED) };
}

function dismiss(id: string) {
  const found = store.active.find((t) => t.id === id);
        store = { ...store, active: store.active.filter((t) => t.id !== id) };
  if (found) archive(found);
  emit();
}

function clearArchive() {
  store = { ...store, archived: [], unread: 0 };
  emit();
}

function removeArchived(id: string) {
  const wasUnread = store.archived.find((t) => t.id === id && !t.read);
        store     = {
    ...store,
    archived: store.archived.filter((t) => t.id !== id),
    unread  : wasUnread ? Math.max(0, store.unread - 1): store.unread,
  };
  emit();
}

function markAllRead() {
  store = { ...store, archived: store.archived.map((t) => (t.read ? t : { ...t, read: true })), unread: 0 };
  emit();
}

function toggle() {
  if (store.open) {
    store = { ...store, open: false };
  } else {
    store = { ...store, open: true, unread: 0, archived: store.archived.map((t) => (t.read ? t : { ...t, read: true })) };
  }
  emit();
}

function close() {
  store = { ...store, open: false };
  emit();
}

function pushConfirm(content: NotificationContent, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const { title, body = '', icon = 'warning' }               = content;
    const { confirmLabel = 'Confirm', cancelLabel = 'Cancel' } = options;
    const t: ToastData                                         = {
      id  : crypto.randomUUID(),
      icon: options.icon ?? icon,
      title,
      body,
      timestamp: new Date(),
      read     : true,
      confirm  : { resolve, confirmLabel, cancelLabel },
    };
    logToastToDevLog(t.icon, title, body);

    const { combined, archived } = enqueue(t);
    store                        = { ...store, active: combined.slice(-MAX_VISIBLE), archived, lastPushId: t.id };
    emit();
  });
}

function decisionLabel(confirm: NonNullable<ToastData['confirm']>, accepted: boolean): string {
  return accepted ? confirm.confirmLabel: confirm.cancelLabel;
}

function respond(id: string, accepted: boolean) {
  const found = store.active.find((t) => t.id === id);
  if (!found?.confirm) {
    dismiss(id);
    return;
  }

  found.confirm.resolve(accepted);
  const label = decisionLabel(found.confirm, accepted);
  void appendAppLog('info', `Confirm "${found.title}": ${label}`).catch(() => {});

  store = { ...store, active: store.active.filter((t) => t.id !== id) };
  archive({ ...found, confirm: undefined, decision: { label, accepted } });
  emit();
}

function cancelPendingConfirms() {
  for (const pending of store.active.filter((t) => t.confirm)) {
    respond(pending.id, false);
  }
}

export const toast = Object.assign((content: NotificationContent) => push(content), {
  success: (content: NotificationContent) => push({ ...content, icon: 'success' }),
  error  : (content: NotificationContent) => push({ ...content, icon: 'error' }),
  warning: (content: NotificationContent) => push({ ...content, icon: 'warning' }),
  info   : (content: NotificationContent) => push({ ...content, icon: 'info' }),
  action : (content: NotificationContent, label: string, fn: () => void) => push(content, { label, fn }),
  confirm: pushConfirm,
  respond,
  cancelPendingConfirms,
  dismiss,
  clearArchive,
  removeArchived,
  markAllRead,
  toggle,
  close,
});

export function useToastStore() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
