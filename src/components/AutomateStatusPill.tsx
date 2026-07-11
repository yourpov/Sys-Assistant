import { motion, useReducedMotion } from 'framer-motion';

import { DynamicIsland, DynamicIslandView } from '@/components/ui/be-ui-dynamic-island';
import { useMotionPreference } from '@/hooks/useMotionPreference';

import { useAutomatePillDisplayState } from '../hooks/useAutomatePillDisplayState';
import type { LogLine } from '../types';
import {
  automatePillLabel,
  automatePillSubtitle,
  type AutomatePillState,
} from '../utils/automateStatus';

const ISLAND_DRAG_RANGE_PX = 5;

const ISLAND_DRAG_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 24,
  mass: 0.62,
};

const ISLAND_DRAG_TRANSITION = {
  bounceStiffness: 420,
  bounceDamping: 16,
  power: 0.3,
  timeConstant: 180,
};

const ISLAND_DRAG_CONSTRAINTS = {
  top: -ISLAND_DRAG_RANGE_PX,
  left: -ISLAND_DRAG_RANGE_PX,
  right: ISLAND_DRAG_RANGE_PX,
  bottom: ISLAND_DRAG_RANGE_PX,
};

interface AutomateStatusPillProps {
  running: boolean;
  swapPreparing: boolean;
  lines: LogLine[];
}

export function AutomateStatusPill({ running, swapPreparing, lines }: AutomateStatusPillProps) {
  const reduceMotion = useReducedMotion() || useMotionPreference();
  const state = useAutomatePillDisplayState(running, swapPreparing, lines);
  const label = automatePillLabel(state, swapPreparing);
  const subtitle = automatePillSubtitle(state, swapPreparing);
  const expanded = state !== 'ready';

  const island = (
    <DynamicIsland
      view={expanded ? state : null}
      noise
      className={`automate-status-island automate-status-island--${state}`}
      compact={
        <div className="automate-status-island-compact">
          <StatusDot state={state} />
          <span>{label}</span>
        </div>
      }
    >
      {expanded ? (
        <DynamicIslandView id={state} className="automate-status-island-view">
          <StatusDot state={state} />
          <div className="automate-status-island-detail">
            <span className="automate-status-island-title">{label}</span>
            <span className="automate-status-island-subtitle">{subtitle}</span>
          </div>
        </DynamicIslandView>
      ) : null}
    </DynamicIsland>
  );

  if (reduceMotion) return island;

  return (
    <motion.div
      className="automate-status-island-drag"
      drag
      dragMomentum={false}
      dragConstraints={ISLAND_DRAG_CONSTRAINTS}
      dragElastic={0.1}
      dragTransition={ISLAND_DRAG_TRANSITION}
      transition={ISLAND_DRAG_SPRING}
      whileTap={{ scale: 0.96 }}
      whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
      onPointerDown={(event) => event.stopPropagation()}
      style={{ cursor: 'grab', touchAction: 'none' }}
    >
      {island}
    </motion.div>
  );
}

function StatusDot({ state }: { state: AutomatePillState }) {
  return (
    <span
      className={`automate-status-dot automate-status-dot--${state}`}
      aria-hidden="true"
    />
  );
}