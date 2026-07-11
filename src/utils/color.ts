export type Rgb = {
  r: number;
  g: number;
  b: number;
};

export type Hsv = {
  h: number;
  s: number;
  v: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHex(hex: string): string {
  const raw = hex.trim().replace(/^#/, '');
  if (raw.length === 3) {
    return `#${raw
      .split('')
      .map((c) => c + c)
      .join('')
      .toLowerCase()}`;
  }
  if (raw.length === 6) return `#${raw.toLowerCase()}`;
  return '#000000';
}

export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn    = r / 255;
  const gn    = g / 255;
  const bn    = b / 255;
  const max   = Math.max(rn, gn, bn);
  const min   = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if   (max === rn) h     = ((gn - bn) / delta) % 6;
    else if (max === gn) h  = (bn - rn) / delta + 2;
    else h                  = (rn - gn) / delta + 4;
         h                 *= 60;
    if   (h < 0) h         += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  return { h, s, v : max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rn = 0;
  let gn = 0;
  let bn = 0;

  if   (h < 60) [rn, gn, bn]     = [c, x, 0];
  else if (h < 120) [rn, gn, bn] = [x, c, 0];
  else if (h < 180) [rn, gn, bn] = [0, c, x];
  else if (h < 240) [rn, gn, bn] = [0, x, c];
  else if (h < 300) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn]              = [c, 0, x];

  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255),
  };
}

export function hsvToHex(hsv: Hsv): string {
  return rgbToHex(hsvToRgb(hsv));
}

export function hexToHsv(hex: string): Hsv {
  return rgbToHsv(hexToRgb(hex));
}