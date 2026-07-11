import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { useMotionPreference } from '@/hooks/useMotionPreference';
import { cn } from '@/lib/utils';

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;
export const EASE_OUT_CSS = 'cubic-bezier(0.16, 1, 0.3, 1)';

export const SPRING_PRESS = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 0.6,
} as const;

export const SPRING_SWAP = {
  type: 'spring',
  stiffness: 460,
  damping: 30,
  mass: 0.55,
} as const;

export const SPRING_PANEL = {
  type: 'spring',
  stiffness: 420,
  damping: 40,
  mass: 0.5,
} as const;

export const SPRING_LAYOUT = {
  type: 'spring',
  stiffness: 360,
  damping: 32,
  mass: 0.6,
} as const;

export const SPRING_MOUSE = {
  stiffness: 200,
  damping: 15,
  mass: 0.3,
} as const;

export function useHoverCapable() {
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHover(mq.matches);

    update();
    mq.addEventListener?.('change', update);

    return () => mq.removeEventListener?.('change', update);
  }, []);

  return canHover;
}

type IslandContextValue = {
  view: string | null;
};

const IslandContext = createContext<IslandContextValue | null>(null);

const SHELL_SPRING = {
  type: 'spring',
  duration: 0.8,
  bounce: 0.2,
} as const;

const CONTENT_SPRING = {
  type: 'spring',
  duration: 0.8,
  bounce: 0.35,
} as const;

const SHELL_RADIUS = {
  pill: 9999,
  card: 12,
} as const;

export type DynamicIslandShape = keyof typeof SHELL_RADIUS;

function useReducedAnimations() {
  const reduceMotion = useReducedMotion();
  const reducePref = useMotionPreference();
  return reduceMotion || reducePref;
}

function Slot({
  keyId,
  children,
  className,
}: {
  keyId: string;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedAnimations();

  return (
    <motion.div
      key={keyId}
      initial={
        reduce
          ? { opacity: 0, filter: 'blur(0px)' }
          : { opacity: 0, scale: 0.9, y: -8, filter: 'blur(5px)' }
      }
      animate={
        reduce
          ? { opacity: 1, filter: 'blur(0px)' }
          : { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }
      }
      exit={
        reduce
          ? { opacity: 0, filter: 'blur(0px)', transition: { duration: 0.1 } }
          : {
              opacity: 0,
              scale: 0.9,
              y: -6,
              filter: 'blur(0px)',
              transition: { duration: 0.08, ease: EASE_OUT },
            }
      }
      transition={reduce ? { duration: 0.15 } : CONTENT_SPRING}
      style={{
        transformOrigin: 'top center',
        willChange: 'transform, opacity, filter',
      }}
      layout
      className={cn(
        'flex shrink-0',
        className?.includes('toast-island-confirm-view')
          ? 'w-full items-stretch justify-start'
          : 'items-center justify-center',
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export interface DynamicIslandProps {
  view: string | null;
  compact?: ReactNode;
  children?: ReactNode;
  className?: string;
  noise?: boolean;
  shape?: DynamicIslandShape;
}

export function DynamicIsland({
  view,
  compact,
  children,
  className,
  noise = false,
  shape = 'pill',
}: DynamicIslandProps) {
  const reduce = useReducedAnimations();
  const expanded = view !== null;

  return (
    <IslandContext.Provider value={{ view }}>
      <motion.div
        role="status"
        aria-live="polite"
        layout
        initial={false}
        transition={reduce ? { duration: 0 } : SHELL_SPRING}
        style={{ borderRadius: SHELL_RADIUS[shape] }}
        className={cn(
          'dynamic-island-shell relative inline-flex overflow-hidden',
          shape === 'card'
            ? 'dynamic-island-shell--card w-[min(360px,calc(100vw-24px))] items-stretch'
            : 'dynamic-island-shell--pill w-fit max-w-[calc(100vw-32px)] items-center justify-center',
          className,
        )}
      >
        {noise ? <div className="glass-noise" aria-hidden="true" /> : null}
        <div
          className={cn(
            'relative z-[1] flex flex-col items-stretch',
            shape === 'card' ? 'w-full min-w-0' : 'w-fit shrink-0',
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {!expanded && compact ? (
              <Slot keyId="compact" className="dynamic-island-compact">
                {compact}
              </Slot>
            ) : null}
          </AnimatePresence>

          {children}
        </div>
      </motion.div>
    </IslandContext.Provider>
  );
}

export interface DynamicIslandViewProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function DynamicIslandView({ id, children, className }: DynamicIslandViewProps) {
  const ctx = useContext(IslandContext);

  if (!ctx) {
    throw new Error('DynamicIslandView must be used inside <DynamicIsland>');
  }

  const active = ctx.view === id;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {active ? (
        <Slot keyId={id} className={cn('dynamic-island-view', className)}>
          {children}
        </Slot>
      ) : null}
    </AnimatePresence>
  );
}

export interface NumberTickerProps {
  value: number;
  format?: (value: number) => string;
  duration?: number;
  className?: string;
  startOnView?: boolean;
}

export function NumberTicker({
  value,
  format = String,
  duration = 0.5,
  className,
}: NumberTickerProps) {
  const reduce = useReducedAnimations();

  return (
    <motion.span
      key={value}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: reduce ? 0.1 : duration }}
      className={className}
    >
      {format(value)}
    </motion.span>
  );
}