import { hexToHsv, hexToRgb, hsvToHex, normalizeHex, type Rgb } from './color';

const STORAGE_KEY = 'accentColor';

const ACCENT_PROPERTIES = [
  '--color-primary',
  '--color-primary-rgb',
  '--color-primary-bright',
  '--color-primary-bright-rgb',
  '--color-primary-deep',
  '--color-primary-soft',
  '--color-primary-border',
  '--color-on-accent',
  '--color-accent-light',
] as const;

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function readableTextFor({ r, g, b }: Rgb): string {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#14101c': '#ffffff';
}

function applyAccentColor(hex: string | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  if (!hex) {
    ACCENT_PROPERTIES.forEach((prop) => root.removeProperty(prop));
    return;
  }

  const normalized = normalizeHex(hex);
  const rgb        = hexToRgb(normalized);
  const hsv        = hexToHsv(normalized);
  const bright     = hsvToHex({ h: hsv.h, s: Math.max(hsv.s - 0.1, 0), v: Math.min(hsv.v + 0.1, 1) });
  const brightRgb  = hexToRgb(bright);
  const deep       = hsvToHex({ h: hsv.h, s: Math.min(hsv.s + 0.05, 1), v: Math.max(hsv.v - 0.15, 0) });
  const light      = hsvToHex({ h: hsv.h, s: 0.28, v: 0.94 });

  root.setProperty('--color-primary', normalized);
  root.setProperty('--color-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.setProperty('--color-primary-bright', bright);
  root.setProperty('--color-primary-bright-rgb', `${brightRgb.r}, ${brightRgb.g}, ${brightRgb.b}`);
  root.setProperty('--color-primary-deep', deep);
  root.setProperty('--color-primary-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
  root.setProperty('--color-primary-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.34)`);
  root.setProperty('--color-on-accent', readableTextFor(rgb));
  root.setProperty('--color-accent-light', light);
}

let current = readStored();
applyAccentColor(current);

export function getAccentColor(): string | null {
  return current;
}

export function syncAccentColor(hex: string | null): void {
  current = hex;
  try {
    if (hex) localStorage.setItem(STORAGE_KEY, hex);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
  applyAccentColor(hex);
}
