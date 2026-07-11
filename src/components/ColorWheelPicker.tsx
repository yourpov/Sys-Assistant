import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { clamp, hexToHsv, hexToRgb, hsvToHex, hsvToRgb, normalizeHex, rgbToHex, type Hsv } from '../utils/color';

const WHEEL_SIZE    = 156;
const WHEEL_RADIUS  = WHEEL_SIZE / 2 - 6;
const PICKER_WIDTH  = 220;
const PICKER_HEIGHT = 360;
const PICKER_GAP    = 8;

type Props = {
  color    : string;
  onChange : (color: string) => void;
  onClose  : () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
};

function drawWheel(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cx    = WHEEL_SIZE / 2;
  const cy    = WHEEL_SIZE / 2;
  const image = ctx.createImageData(WHEEL_SIZE, WHEEL_SIZE);
  const data  = image.data;

  for (let y = 0; y < WHEEL_SIZE; y++) {
    for (let x = 0; x < WHEEL_SIZE; x++) {
      const dx    = x - cx + 0.5;
      const dy    = y - cy + 0.5;
      const dist  = Math.sqrt(dx * dx + dy * dy);
      const index = (y * WHEEL_SIZE + x) * 4;

      if (dist > WHEEL_RADIUS) {
        data[index + 3] = 0;
        continue;
      }

      const angle       = (Math.atan2(dy, dx) * 180) / Math.PI;
      const hue         = angle < 0 ? angle + 360 : angle;
      const sat         = clamp(dist / WHEEL_RADIUS, 0, 1);
      const { r, g, b } = hsvToRgb({ h: hue, s: sat, v: 1 });
      data [index]      = r;
      data [index + 1]  = g;
      data [index + 2]  = b;
      data [index + 3]  = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

function wheelPointer(hsv: Hsv): { x: number; y: number } {
  const angle = (hsv.h * Math.PI) / 180;
  const dist  = hsv.s * WHEEL_RADIUS;
  return {
    x: WHEEL_SIZE / 2 + Math.cos(angle) * dist,
    y: WHEEL_SIZE / 2 + Math.sin(angle) * dist,
  };
}

function hsvFromWheelPoint(x: number, y: number): Pick<Hsv, 'h' | 's'> {
  const cx    = WHEEL_SIZE / 2;
  const cy    = WHEEL_SIZE / 2;
  const dx    = x - cx;
  const dy    = y - cy;
  const dist  = Math.min(Math.sqrt(dx * dx + dy * dy), WHEEL_RADIUS);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const hue   = angle < 0 ? angle + 360 : angle;
  return { h: hue, s: dist / WHEEL_RADIUS };
}

export function ColorWheelPicker({ color, onChange, onClose, anchorRef }: Props) {
  const panelRef      = useRef<HTMLDivElement>(null);
  const wheelRef      = useRef<HTMLCanvasElement>(null);
  const wheelDragging = useRef(false);
  const valueDragging = useRef(false);
  const hsvRef        = useRef<Hsv>(hexToHsv(normalizeHex(color)));
  const labelId       = useId();

  const [hsv, setHsv]               = useState<Hsv>(() => hexToHsv(normalizeHex(color)));
  const [rgbText, setRgbText]       = useState(() => hexToRgb(normalizeHex(color)));
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect       = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove  = spaceBelow < PICKER_HEIGHT + PICKER_GAP && rect.top > PICKER_HEIGHT + PICKER_GAP;
    const top        = openAbove ? rect.top - PICKER_HEIGHT - PICKER_GAP : rect.bottom + PICKER_GAP;
    const left       = clamp(rect.left, 12, window.innerWidth - PICKER_WIDTH - 12);

    setPanelStyle({ top, left, visibility: 'visible' });
  }, [anchorRef]);

  useEffect(() => {
    const next           = hexToHsv(normalizeHex(color));
          hsvRef.current = next;
    setHsv(next);
    setRgbText(hexToRgb(normalizeHex(color)));
  }, [color]);

  useEffect(() => {
    if (!wheelRef.current) return;
    drawWheel(wheelRef.current);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchorRef, onClose]);

  const commitHsv = useCallback(
    (next: Hsv) => {
      hsvRef.current = next;
      setHsv(next);
      setRgbText(hsvToRgb(next));
      onChange(hsvToHex(next));
    },
    [onChange],
  );

  useEffect(() => {
    const onWheelPointer = (clientX: number, clientY: number) => {
      const canvas = wheelRef.current;
      if (!canvas) return;
      const rect     = canvas.getBoundingClientRect();
      const x        = ((clientX - rect.left) / rect.width) * WHEEL_SIZE;
      const y        = ((clientY - rect.top) / rect.height) * WHEEL_SIZE;
      const { h, s } = hsvFromWheelPoint(x, y);
      commitHsv({ h, s, v: hsvRef.current.v });
    };

    const onValuePointer = (clientX: number) => {
      const track = panelRef.current?.querySelector<HTMLElement>('.color-wheel-value-track');
      if (!track) return;
      const rect  = track.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      commitHsv({ ...hsvRef.current, v: ratio });
    };

    const onMove = (event: PointerEvent) => {
      if (wheelDragging.current) onWheelPointer(event.clientX, event.clientY);
      if (valueDragging.current) onValuePointer(event.clientX);
    };
    const onUp = () => {
      wheelDragging.current = false;
      valueDragging.current = false;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [commitHsv]);

  const pointer       = wheelPointer(hsv);
  const preview       = hsvToHex(hsv);
  const valueGradient = `linear-gradient(to right, #000, ${hsvToHex({ ...hsv, v: 1 })})`;

  const setRgbChannel = (channel: 'r' | 'g' | 'b', raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const nextRgb = { ...rgbText, [channel]: clamp(parsed, 0, 255) };
    setRgbText(nextRgb);
    commitHsv(hexToHsv(rgbToHex(nextRgb)));
  };

  return createPortal(
    <div ref = {panelRef} className = "color-wheel-picker" role = "dialog" aria-labelledby = {labelId} style = {panelStyle}>
    <p   id  = {labelId} className  = "color-wheel-picker-title">
        Pick a color
      </p>

      <div className = "color-wheel-stage">
        <canvas
          ref           = {wheelRef}
          className     = "color-wheel-canvas"
          width         = {WHEEL_SIZE}
          height        = {WHEEL_SIZE}
          onPointerDown = {(event) => {
                  wheelDragging.current = true;
            const rect                  = event.currentTarget.getBoundingClientRect();
            const x                     = ((event.clientX - rect.left) / rect.width) * WHEEL_SIZE;
            const y                     = ((event.clientY - rect.top) / rect.height) * WHEEL_SIZE;
            const { h, s }              = hsvFromWheelPoint(x, y);
            commitHsv({ h, s, v: hsvRef.current.v });
          }}
        />
        <div
          className   = "color-wheel-pointer"
          style       = {{ left: `${(pointer.x / WHEEL_SIZE) * 100}%`, top: `${(pointer.y / WHEEL_SIZE) * 100}%` }}
          aria-hidden = "true"
        />
      </div>

      <div  className = "color-wheel-value">
      <span className = "color-wheel-value-label">Brightness</span>
        <div
          className     = "color-wheel-value-track"
          style         = {{ background: valueGradient }}
          onPointerDown = {(event) => {
                  valueDragging.current = true;
            const rect                  = event.currentTarget.getBoundingClientRect();
            const ratio                 = clamp((event.clientX - rect.left) / rect.width, 0, 1);
            commitHsv({ ...hsvRef.current, v: ratio });
          }}
        >
          <div className = "color-wheel-value-thumb" style = {{ left: `${hsv.v * 100}%` }} />
        </div>
      </div>

      <div className = "color-wheel-rgb">
        {(['r', 'g', 'b'] as const).map((channel) => (
          <label key = {channel} className = "color-wheel-rgb-field">
            <span>{channel.toUpperCase()}</span>
            <input
              type     = "number"
              min      = {0}
              max      = {255}
              value    = {rgbText[channel]}
              onChange = {(e) => setRgbChannel(channel, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div  className = "color-wheel-footer">
      <div  className = "color-wheel-preview" style = {{ backgroundColor: preview }} />
      <span className = "color-wheel-hex">{preview}</span>
      </div>
    </div>,
    document.body,
  );
}