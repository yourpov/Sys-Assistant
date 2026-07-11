const STORAGE_KEY = 'reduceAnimationsEnabled';

let settingEnabled = false;
const listeners    = new Set<() => void>();

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function systemReduced(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getReduceMotion(): boolean {
  return settingEnabled || systemReduced();
}

function applyDocumentFlag(): void {
  if (typeof document === 'undefined') return;
  if (getReduceMotion()) {
    document.documentElement.setAttribute('data-reduce-motion', 'true');
  } else {
    document.documentElement.removeAttribute('data-reduce-motion');
  }
}

function notifyListeners(): void {
  applyDocumentFlag();
  listeners.forEach((listener) => listener());
}

export function syncReduceMotion(enabled: boolean): void {
  settingEnabled = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch { }
  notifyListeners();
}

export function initReduceMotion(enabled?: boolean): void {
  if (typeof enabled === 'boolean') {
    syncReduceMotion(enabled);
    return;
  }
  settingEnabled = readStored();
  notifyListeners();
}

export function subscribeReduceMotion(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function watchSystemReduceMotion(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onChange = () => notifyListeners();

  mq.addEventListener?.('change', onChange);
  return () => mq.removeEventListener?.('change', onChange);
}