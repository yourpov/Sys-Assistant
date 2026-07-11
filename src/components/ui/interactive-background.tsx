import { useCallback, useEffect, useRef, type RefObject } from 'react';

const GRID_SPACING   = 21;
const BG_COLOR       = '#0b0912';
const GLOW_RADIUS    = 96;
const PUSH_RADIUS    = 56;
const PUSH_FORCE     = 18;
const RESTORE_SPEED  = 0.14;
const MAX_DPR        = 1.25;
const AFFECT_RADIUS  = GLOW_RADIUS + PUSH_RADIUS;

interface Dot {
  ox       : number;
  oy       : number;
  cx       : number;
  cy       : number;
  baseAlpha: number;
}

interface Pointer {
  x: number;
  y: number;
  active: boolean;
}

function buildDots(width: number, height: number): Dot[] {
  const dots: Dot[] = [];
  for (let y = GRID_SPACING * 0.5; y < height; y += GRID_SPACING) {
    for (let x = GRID_SPACING * 0.5; x < width; x += GRID_SPACING) {
      dots.push({
        ox       : x,
        oy       : y,
        cx       : x,
        cy       : y,
        baseAlpha: 0.052 + Math.random() * 0.024,
      });
    }
  }
  return dots;
}

function paintDot(
  ctx: CanvasRenderingContext2D,
  dot: Dot,
  pointer: Pointer,
) {
  let alpha  = dot.baseAlpha;
  let red    = 255;
  let green  = 255;
  let blue   = 255;
  let radius = 1.15;

  if (pointer.active) {
    const dx   = dot.cx - pointer.x;
    const dy   = dot.cy - pointer.y;
    const dist = Math.hypot(dx, dy);
    if (dist < GLOW_RADIUS) {
      const influence = 1 - dist / GLOW_RADIUS;
      alpha += influence * 0.14;
      red    = 255 - influence * 94;
      green  = 255 - influence * 200;
      blue   = 255 - influence * 16;
      radius = 1 + influence * 0.55;
    }
  }

  ctx.beginPath();
  ctx.fillStyle = `rgba(${red | 0}, ${green | 0}, ${blue | 0}, ${alpha})`;
  ctx.arc(dot.cx, dot.cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function paintAmbientGlow(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cx     = width * 0.5;
  const cy     = height * 0.42;
  const radius = Math.max(width, height) * 0.72;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(161, 17, 255, 0.1)');
  gradient.addColorStop(0.4, 'rgba(161, 17, 255, 0.035)');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function paintStaticDots(ctx: CanvasRenderingContext2D, dots: Dot[], width: number, height: number) {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);
  paintAmbientGlow(ctx, width, height);

  for (const dot of dots) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${dot.baseAlpha})`;
    ctx.arc(dot.ox, dot.oy, 1.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface InteractiveBackgroundProps {
  className       ?: string;
  pointerTargetRef?: RefObject<HTMLElement | null>;
}

export function InteractiveBackground({
  className,
  pointerTargetRef,
}: InteractiveBackgroundProps) {
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dotsRef         = useRef<Dot[]>([]);
  const pointerRef      = useRef<Pointer>({ x: 0, y: 0, active: false });
  const animationIdRef  = useRef<number | null>(null);
  const pendingPointerRef = useRef<PointerEvent | null>(null);
  const pointerFrameRef   = useRef<number>(0);

  const stopAnimation = useCallback(() => {
    if (animationIdRef.current !== null) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const pointer = pointerRef.current;
    const staticCanvas = staticCanvasRef.current;

    if (staticCanvas) {
      ctx.drawImage(staticCanvas, 0, 0, canvas.width, canvas.height);
    } else {
      const width  = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      paintAmbientGlow(ctx, width, height);
    }

    if (pointer.active) {
      const gradient = ctx.createRadialGradient(
        pointer.x, pointer.y, 0,
        pointer.x, pointer.y, GLOW_RADIUS,
      );
      gradient.addColorStop(0, 'rgba(161, 17, 255, 0.1)');
      gradient.addColorStop(0.35, 'rgba(161, 17, 255, 0.03)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    let moving = false;
    const affectRadiusSq = AFFECT_RADIUS * AFFECT_RADIUS;

    for (const dot of dotsRef.current) {
      if (pointer.active) {
        const dx     = dot.cx - pointer.x;
        const dy     = dot.cy - pointer.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < affectRadiusSq) {
          const dist = Math.sqrt(distSq);
          if (dist < PUSH_RADIUS && dist > 0) {
            const force = ((PUSH_RADIUS - dist) / PUSH_RADIUS) * PUSH_FORCE;
            dot.cx += (dx / dist) * force;
            dot.cy += (dy / dist) * force;
            moving = true;
          }
        }
      }

      const odx      = dot.ox - dot.cx;
      const ody      = dot.oy - dot.cy;
      const distance = Math.hypot(odx, ody);
      if (distance > 0.4) {
        const restore = Math.min(distance * RESTORE_SPEED, 2.4);
        dot.cx += (odx / distance) * restore;
        dot.cy += (ody / distance) * restore;
        moving = true;
      } else {
        dot.cx = dot.ox;
        dot.cy = dot.oy;
      }

      const displaced = Math.hypot(dot.cx - dot.ox, dot.cy - dot.oy) > 0.35;
      const highlighted = pointer.active
        && (dot.cx - pointer.x) ** 2 + (dot.cy - pointer.y) ** 2 < GLOW_RADIUS * GLOW_RADIUS;
      if (displaced || highlighted) {
        paintDot(ctx, dot, pointer);
      }
    }

    if (pointer.active || moving) {
      animationIdRef.current = requestAnimationFrame(draw);
    } else {
      animationIdRef.current = null;
    }
  }, []);

  const startAnimation = useCallback(() => {
    if (animationIdRef.current === null) {
      animationIdRef.current = requestAnimationFrame(draw);
    }
  }, [draw]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    const width  = parent?.clientWidth ?? window.innerWidth;
    const height = parent?.clientHeight ?? window.innerHeight;
    const dpr    = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    canvas.width  = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width  = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dotsRef.current = buildDots(width, height);

    if (!staticCanvasRef.current) {
      staticCanvasRef.current = document.createElement('canvas');
    }
    const staticCanvas = staticCanvasRef.current;
    staticCanvas.width  = canvas.width;
    staticCanvas.height = canvas.height;
    const staticCtx = staticCanvas.getContext('2d');
    if (staticCtx) {
      staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintStaticDots(staticCtx, dotsRef.current, width, height);
    }

    draw();
  }, [draw]);

  useEffect(() => {
    resize();

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    const parent   = canvasRef.current?.parentElement;
    const observer = parent ? new ResizeObserver(() => resize()) : null;
    observer?.observe(parent!);

    return () => {
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
      stopAnimation();
      staticCanvasRef.current = null;
    };
  }, [resize, stopAnimation]);

  useEffect(() => {
    const applyPointer = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const bounds = pointerTargetRef?.current;
      if (!canvas) return;

      if (bounds) {
        const box = bounds.getBoundingClientRect();
        const inside = clientX >= box.left && clientX <= box.right
          && clientY >= box.top && clientY <= box.bottom;
        if (!inside) {
          if (pointerRef.current.active) {
            pointerRef.current.active = false;
            startAnimation();
          }
          return;
        }
      }

      const rect = canvas.getBoundingClientRect();
      pointerRef.current = {
        x     : clientX - rect.left,
        y     : clientY - rect.top,
        active: true,
      };
      startAnimation();
    };

    const onPointerMove = (event: PointerEvent) => {
      pendingPointerRef.current = event;
      if (pointerFrameRef.current) return;
      pointerFrameRef.current = requestAnimationFrame(() => {
        pointerFrameRef.current = 0;
        const pending = pendingPointerRef.current;
        if (!pending) return;
        applyPointer(pending.clientX, pending.clientY);
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (pointerFrameRef.current) cancelAnimationFrame(pointerFrameRef.current);
    };
  }, [pointerTargetRef, startAnimation]);

  return (
    <canvas
      ref         = {canvasRef}
      aria-hidden = "true"
      className   = {`interactive-background${className ? ` ${className}` : ''}`}
    />
  );
}