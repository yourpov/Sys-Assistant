import { AnimatePresence } from 'framer-motion';

import { useToastStore } from '../hooks/useToastStore';
import { Toast }         from './Toast';

export function ToastContainer() {
  const { active } = useToastStore();
  const hasConfirm = active.some((t) => t.confirm);

  return (
    <div className = {`toast-container${hasConfirm ? ' toast-container--confirm' : ''}`}>
      <GlassNoiseFilter />
      <AnimatePresence mode = "popLayout">
        {active.map((t) => (
          <Toast key = {t.id} data = {t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function GlassNoiseFilter() {
  return (
    <svg               width            = "0" height                   = "0" style                = {{ position: 'absolute' }} aria-hidden = "true">
    <filter            id               = "glass-noise">
    <feTurbulence      type             = "fractalNoise" baseFrequency = "0.012 0.012" numOctaves = "2" result                             = "warp" />
    <feDisplacementMap xChannelSelector = "R" yChannelSelector         = "G" scale                = "6" in                                 = "SourceGraphic" in2 = "warp" />
      </filter>
    </svg>
  );
}
