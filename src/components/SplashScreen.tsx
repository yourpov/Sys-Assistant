import { openUrl }             from '@tauri-apps/plugin-opener';
import { useEffect, useRef, useState } from 'react';

import { getAppCredit }   from '../api/credit';
import { getSettings }    from '../api/settings';
import logoWatermark      from '../assets/logo-watermark.png';
import { useMotionPreference } from '../hooks/useMotionPreference';
import { useMouseGlow }   from '../hooks/useMouseGlow';
import type { AppCredit } from '../types';
import { MorphingText }   from './MorphingText';
import { InteractiveBackground } from './ui/interactive-background';
import { ParticleTextBand } from './ui/ParticleTextBand';
import { syncReduceMotion } from '../utils/motionPreference';
import { logSilentFailure } from '../utils/silentError';

const SPLASH_DURATION_MS = 5000;
const FADE_DURATION_MS   = 300;
const DISCORD_URL        = 'https://sys-info.xyz/discord';
const TRACEX_URL         = 'https://sys-info.xyz/Private-TraceX-Bundle';

const TAGLINE_PHRASES = ['Automation made easy',  'Version 0.3.0'];

const STATUS_COLORS: Record<string, string> = {
  online : 'bg-emerald-500',
  idle   : 'bg-amber-500',
  dnd    : 'bg-red-500',
  offline: 'bg-zinc-500',
};

interface Props {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: Props) {
  const glowRef               = useMouseGlow<HTMLDivElement>();
  const reduceMotion          = useMotionPreference();
  const [closing, setClosing] = useState(false);
  const [credit, setCredit]   = useState<AppCredit | null>(null);
  const finishedRef           = useRef(false);
  const closeTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishOnce = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  };

  const skip = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    setClosing(true);
    setTimeout(finishOnce, FADE_DURATION_MS);
  };

  useEffect(() => {
    closeTimerRef.current  = setTimeout(() => setClosing(true), SPLASH_DURATION_MS - FADE_DURATION_MS);
    finishTimerRef.current = setTimeout(finishOnce, SPLASH_DURATION_MS);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, [onFinish]);

  useEffect(() => {
    getSettings()
      .then((settings) => syncReduceMotion(settings.reduceAnimationsEnabled))
      .catch((e) => logSilentFailure('splash.settings', e));

    getAppCredit()
      .then(setCredit)
      .catch((e) => {
        logSilentFailure('splash.credit', e);
        setCredit(null);
      });
  }, []);

  return (
    <div
      ref       = {glowRef}
      onClick   = {skip}
      className = {`splash-screen cursor-pointer${reduceMotion ? ' splash-screen--static-bg' : ''}`}
      style     = {{ opacity: closing ? 0 : 1 }}
    >
      {!reduceMotion && (
        <>
          <InteractiveBackground pointerTargetRef={glowRef} />
          <div className="app-shell-glow" aria-hidden="true" />
        </>
      )}

      <ParticleTextBand
        text="AUTOMATE"
        size="splash"
        pointerTargetRef={glowRef}
        className="splash-foreground"
      />

      <div className="splash-content splash-foreground">
        <img src = {logoWatermark} alt = "" className = "h-28 w-auto" />

        <div className = "text-center">
          <div className = "text-2xl font-extrabold tracking-widest text-app-primary uppercase">Private Assistant</div>
          <p className = "mt-2 text-sm text-app-faint">for the Sys-Info community</p>
          <MorphingText texts = {TAGLINE_PHRASES} className = "mt-1 max-w-xs mx-auto text-lg font-semibold text-app-muted" />
        </div>

        <div className = "flex flex-col items-center gap-3">
          <button
            type      = "button"
            onClick   = {(event) => { event.stopPropagation(); void openUrl(TRACEX_URL); }}
            className = "rounded-full bg-violet-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-violet-500"
          >
            Get the Private TraceX Bundle
          </button>
          <button
            type      = "button"
            onClick   = {(event) => { event.stopPropagation(); void openUrl(DISCORD_URL); }}
            className = "splash-discord-btn"
          >
            Join the Discord
          </button>
        </div>

        <div className = "splash-progress-track">
          <div className = "splash-progress-fill" style = {{ animationDuration: `${SPLASH_DURATION_MS - FADE_DURATION_MS}ms` }} />
        </div>

        {credit && <CreditBadge credit={credit} />}
      </div>
    </div>
  );
}

function CreditBadge({ credit }: { credit: AppCredit }) {
  return (
    <div className = "flex items-center gap-2">
      <div className = "relative h-8 w-8 shrink-0">
        <img src = {credit.avatarDataUrl} alt = "" className = "h-8 w-8 rounded-full opacity-80" />
        {credit.decorationDataUrl && <img src={credit.decorationDataUrl} alt="" className="absolute -inset-1 h-10 w-10" />}
        <span
          className = {`absolute right-0 bottom-0 h-2 w-2 rounded-full border border-[#12101c] ${STATUS_COLORS[credit.status] ?? STATUS_COLORS.offline}`}
        />
      </div>
      <div className = "text-left leading-tight">
        <div className = "text-xs text-app-muted">
          made by <span className = "font-semibold text-app-tertiary">{credit.displayName}</span>
        </div>
        <div className = "text-[11px] text-app-faint">{credit.activityText ?? `@${credit.username}`}</div>
      </div>
    </div>
  );
}