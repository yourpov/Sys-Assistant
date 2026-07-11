import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

interface Pointer {
  x?: number;
  y?: number;
}

interface TextBox {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParticleTextEffectProps {
  text?: string;
  colors?: string[];
  className?: string;
  animationForce?: number;
  particleDensity?: number;
  fill?: 'parent' | 'window';
  pointerTargetRef?: RefObject<HTMLElement | null>;
}

interface Particle {
  ox: number;
  oy: number;
  cx: number;
  cy: number;
  or: number;
  cr: number;
  f: number;
  rgb: number[];
  draw: () => void;
  move: (interactionRadius: number, hasPointer: boolean, activePointer: Pointer) => void;
}

function rand(max = 1, min = 0, dec = 0): number {
  return +(min + Math.random() * (max - min)).toFixed(dec);
}

function createParticle(
  x: number,
  y: number,
  ctx: CanvasRenderingContext2D,
  animationForce: number,
  rgb: number[] = [rand(128), rand(128), rand(128)],
): Particle {
  const tone = rgb.map((channel) => Math.max(0, channel + rand(13, -13)));
  const or   = rand(5, 1);

  return {
    ox : x,
    oy : y,
    cx : x,
    cy : y,
    or,
    cr : or,
    f  : rand(animationForce + 15, animationForce - 15),
    rgb: tone,
    draw() {
      ctx.fillStyle = `rgb(${this.rgb.join(',')})`;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.cr, 0, 2 * Math.PI);
      ctx.fill();
    },
    move(interactionRadius, hasPointer, activePointer: Pointer) {
      if (hasPointer && activePointer.x !== undefined && activePointer.y !== undefined) {
        const dx   = this.cx - activePointer.x;
        const dy   = this.cy - activePointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist < interactionRadius && dist > 0) {
          const force = Math.min(this.f, ((interactionRadius - dist) / dist) * 2);
          this.cx += (dx / dist) * force;
          this.cy += (dy / dist) * force;
        }
      }

      const odx      = this.ox - this.cx;
      const ody      = this.oy - this.cy;
      const distance = Math.hypot(odx, ody);
      if (distance > 1) {
        const restore = Math.min(distance * 0.1, 3);
        this.cx += (odx / distance) * restore;
        this.cy += (ody / distance) * restore;
      }

      this.draw();
    },
  };
}

export function ParticleTextEffect({
  text             = 'HOVER!',
  colors           = [
    'ffad70', 'f7d297', 'edb9a1', 'e697ac', 'b38dca',
    '9c76db', '705cb5', '43428e', '2c2142',
  ],
  className        = '',
  animationForce   = 80,
  particleDensity  = 4,
  fill             = 'parent',
  pointerTargetRef,
}: ParticleTextEffectProps) {
  const canvasRef            = useRef<HTMLCanvasElement>(null);
  const ctxRef               = useRef<CanvasRenderingContext2D | null>(null);
  const animationIdRef       = useRef<number | null>(null);
  const particlesRef         = useRef<Particle[]>([]);
  const hasPointerRef        = useRef(false);
  const interactionRadiusRef = useRef(100);
  const textBoxRef           = useRef<TextBox>({ str: text, x: 0, y: 0, w: 0, h: 0 });
  const pointerRef           = useRef<Pointer>({});

  const stopAnimation = useCallback(() => {
    if (animationIdRef.current !== null) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
  }, []);

  const startAnimation = useCallback(() => {
    const ctx    = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach((particle) => {
        particle.move(interactionRadiusRef.current, hasPointerRef.current, pointerRef.current);
      });
      animationIdRef.current = requestAnimationFrame(animate);
    };

    stopAnimation();
    animationIdRef.current = requestAnimationFrame(animate);
  }, [stopAnimation]);

  const dottify = useCallback(() => {
    const ctx      = ctxRef.current;
    const canvas   = canvasRef.current;
    const textBox  = textBoxRef.current;
    if (!ctx || !canvas || textBox.w <= 0 || textBox.h <= 0) return;

    const data = ctx.getImageData(textBox.x, textBox.y, textBox.w, textBox.h).data;
    const pixels = data
      .reduce<Array<{ x: number; y: number; rgb: number[] }>>((arr, _, index, buffer) => {
        if (index % 4 === 0) {
          arr.push({
            x  : (index / 4) % textBox.w,
            y  : Math.floor(index / 4 / textBox.w),
            rgb: Array.from(buffer.slice(index, index + 4)),
          });
        }
        return arr;
      }, [])
      .filter((pixel) => pixel.rgb[3] > 0 && pixel.x % particleDensity === 0 && pixel.y % particleDensity === 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particlesRef.current = pixels.map((pixel) =>
      createParticle(
        textBox.x + pixel.x,
        textBox.y + pixel.y,
        ctx,
        animationForce,
        pixel.rgb.slice(0, 3),
      ),
    );

    particlesRef.current.forEach((particle) => particle.draw());
  }, [animationForce, particleDensity]);

  const write = useCallback(() => {
    const canvas  = canvasRef.current;
    const ctx     = ctxRef.current;
    const textBox = textBoxRef.current;
    if (!canvas || !ctx || canvas.width === 0 || canvas.height === 0) return;

    textBox.str = text;
    const byHeight = Math.floor(canvas.height * 0.9);
    const byWidth  = Math.floor(canvas.width / (text.length * 0.62));
    textBox.h      = Math.max(24, Math.min(byHeight, byWidth));

    interactionRadiusRef.current = Math.max(50, textBox.h * 1.5);

    ctx.font         = `900 ${textBox.h}px Verdana, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    textBox.w = Math.round(ctx.measureText(textBox.str).width);
    textBox.x = 0.5 * (canvas.width - textBox.w);
    textBox.y = 0.5 * (canvas.height - textBox.h);

    const gradient = ctx.createLinearGradient(textBox.x, textBox.y, textBox.x + textBox.w, textBox.y + textBox.h);
    colors.forEach((color, index) => {
      gradient.addColorStop(index / Math.max(colors.length - 1, 1), `#${color}`);
    });
    ctx.fillStyle = gradient;
    ctx.fillText(textBox.str, canvas.width * 0.5, canvas.height * 0.5);
    dottify();
  }, [colors, dottify, text]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx    = ctxRef.current;
    if (!canvas || !ctx) return;

    if (fill === 'parent') {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect   = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
    } else {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    write();
    startAnimation();
  }, [fill, startAnimation, write]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    resizeCanvas();

    const observer = fill === 'parent' && canvas.parentElement
      ? new ResizeObserver(() => resizeCanvas())
      : null;
    observer?.observe(canvas.parentElement!);

    const onWindowResize = () => {
      if (fill === 'window') resizeCanvas();
    };
    window.addEventListener('resize', onWindowResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onWindowResize);
      stopAnimation();
    };
  }, [fill, resizeCanvas, stopAnimation]);

  useEffect(() => {
    resizeCanvas();
  }, [resizeCanvas, text, colors, animationForce, particleDensity]);

  const updatePointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    pointerRef.current = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
    hasPointerRef.current = true;
    startAnimation();
  }, [startAnimation]);

  const clearPointer = useCallback(() => {
    hasPointerRef.current = false;
    pointerRef.current    = {};
    startAnimation();
  }, [startAnimation]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    updatePointer(event.clientX, event.clientY);
  };

  useEffect(() => {
    const target = pointerTargetRef?.current;
    if (!target) return;

    const onPointerMove = (event: PointerEvent) => {
      updatePointer(event.clientX, event.clientY);
    };
    const onPointerLeave = () => clearPointer();
    const onPointerEnter = () => {
      hasPointerRef.current = true;
    };

    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerleave', onPointerLeave);
    target.addEventListener('pointerenter', onPointerEnter);

    return () => {
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerleave', onPointerLeave);
      target.removeEventListener('pointerenter', onPointerEnter);
    };
  }, [clearPointer, pointerTargetRef, updatePointer]);

  const canvasPointerHandlers = pointerTargetRef
    ? {}
    : {
        onPointerMove  : handlePointerMove,
        onPointerLeave : clearPointer,
        onPointerEnter : () => { hasPointerRef.current = true; },
      };

  return (
    <canvas
      ref              = {canvasRef}
      aria-hidden      = "true"
      className        = {`h-full w-full cursor-none ${className}`.trim()}
      {...canvasPointerHandlers}
    />
  );
}