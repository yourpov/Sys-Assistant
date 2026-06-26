import { useEffect, useRef } from 'react';

const LEAN_AMOUNT = 0.1;

export function useMouseGlow<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let queuedEvent: MouseEvent | null = null;
    let frame = 0;

    const applyGlow = () => {
      frame = 0;
      const e = queuedEvent;
      if (!e) return;
      const rect = element.getBoundingClientRect();
      const offsetX = (e.clientX - rect.left) / rect.width - 0.5;
      const offsetY = (e.clientY - rect.top) / rect.height - 0.5;
      element.style.setProperty('--glow-x', `${(0.5 + offsetX * LEAN_AMOUNT) * 100}%`);
      element.style.setProperty('--glow-y', `${(0.5 + offsetY * LEAN_AMOUNT) * 100}%`);
    };

    const handleMouseMove = (e: MouseEvent) => {
      queuedEvent = e;
      if (!frame) {
        frame = requestAnimationFrame(applyGlow);
      }
    };

    element.addEventListener('mousemove', handleMouseMove);
    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}
