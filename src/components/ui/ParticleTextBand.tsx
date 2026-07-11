import type { RefObject } from 'react';

import { PARTICLE_TEXT_COLORS } from '@/constants/particleText';
import { useMotionPreference } from '@/hooks/useMotionPreference';

import { ParticleTextEffect } from './interactive-text-particle';

export type ParticleTextBandSize = 'splash' | 'hero' | 'compact';

interface Props {
  text             : string;
  size            ?: ParticleTextBandSize;
  pointerTargetRef?: RefObject<HTMLElement | null>;
  className       ?: string;
  colors          ?: string[];
  particleDensity ?: number;
  animationForce  ?: number;
}

const SIZE_CLASS: Record<ParticleTextBandSize, string> = {
  splash : 'particle-text-band particle-text-band--splash',
  hero   : 'particle-text-band particle-text-band--hero',
  compact: 'particle-text-band particle-text-band--compact',
};

export function ParticleTextBand({
  text,
  size             = 'compact',
  pointerTargetRef,
  className,
  colors           = [...PARTICLE_TEXT_COLORS],
  particleDensity  = 4,
  animationForce   = 70,
}: Props) {
  const reduceMotion = useMotionPreference();

  if (reduceMotion) {
    return (
      <div
        aria-hidden
        className={`particle-text-band particle-text-band--static particle-text-band--${size}${className ? ` ${className}` : ''}`}
      >
        {text}
      </div>
    );
  }

  return (
    <div className={`${SIZE_CLASS[size]}${className ? ` ${className}` : ''}`} aria-hidden>
      <ParticleTextEffect
        text={text}
        fill="parent"
        pointerTargetRef={pointerTargetRef}
        colors={colors}
        particleDensity={particleDensity}
        animationForce={animationForce}
        className="particle-text-band-canvas"
      />
    </div>
  );
}