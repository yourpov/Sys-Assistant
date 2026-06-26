import { openUrl } from '@tauri-apps/plugin-opener';
import { useEffect, useState } from 'react';

import { getAppCredit } from '../api/credit';
import logoWatermark from '../assets/logo-watermark.png';
import { useMouseGlow } from '../hooks/useMouseGlow';
import type { AppCredit } from '../types';

const SPLASH_DURATION_MS = 5000;
const FADE_DURATION_MS = 300;
const DISCORD_URL = 'https://sys-info.xyz/discord';
const TRACEX_URL = 'https://sys-info.xyz/Private-TraceX-Bundle';

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-500',
  dnd: 'bg-red-500',
  offline: 'bg-zinc-500',
};

interface Props {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: Props) {
  const glowRef = useMouseGlow<HTMLDivElement>();
  const [closing, setClosing] = useState(false);
  const [credit, setCredit] = useState<AppCredit | null>(null);

  const skip = () => {
    setClosing(true);
    setTimeout(onFinish, FADE_DURATION_MS);
  };

  useEffect(() => {
    const closeTimer = setTimeout(() => setClosing(true), SPLASH_DURATION_MS - FADE_DURATION_MS);
    const finishTimer = setTimeout(onFinish, SPLASH_DURATION_MS);
    return () => {
      clearTimeout(closeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  useEffect(() => {
    getAppCredit()
      .then(setCredit)
      .catch(() => setCredit(null));
  }, []);

  return (
    <div ref={glowRef} onClick={skip} className="splash-screen cursor-pointer" style={{ opacity: closing ? 0 : 1 }}>
      <img src={logoWatermark} alt="" className="h-28 w-auto" />

      <div className="text-center">
        <div className="text-2xl font-extrabold tracking-widest text-white/95 uppercase">Private Assistant</div>
        <p className="mt-2 text-sm text-white/45">for the Sys-Info community</p>
        <p className="mt-1 text-xs text-white/35">Setup & Account Automation, Configs, and Tools</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => openUrl(TRACEX_URL)}
          className="rounded-full bg-violet-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-violet-500"
        >
          Get the Private TraceX Bundle
        </button>
        <button
          type="button"
          onClick={() => openUrl(DISCORD_URL)}
          className="rounded-full border border-white/15 px-6 py-2 text-sm font-semibold text-white/70 transition-colors hover:border-violet-400 hover:text-white"
        >
          Join the Discord
        </button>
      </div>

      <div className="splash-progress-track">
        <div className="splash-progress-fill" style={{ animationDuration: `${SPLASH_DURATION_MS - FADE_DURATION_MS}ms` }} />
      </div>

      {credit && <CreditBadge credit={credit} />}
    </div>
  );
}

function CreditBadge({ credit }: { credit: AppCredit }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-8 w-8 shrink-0">
        <img src={credit.avatarDataUrl} alt="" className="h-8 w-8 rounded-full opacity-80" />
        {credit.decorationDataUrl && <img src={credit.decorationDataUrl} alt="" className="absolute -inset-1 h-10 w-10" />}
        <span
          className={`absolute right-0 bottom-0 h-2 w-2 rounded-full border border-[#080810] ${STATUS_COLORS[credit.status] ?? STATUS_COLORS.offline}`}
        />
      </div>
      <div className="text-left leading-tight">
        <div className="text-xs text-white/50">
          made by <span className="font-semibold text-white/75">{credit.displayName}</span>
        </div>
        <div className="text-[11px] text-white/40">{credit.activityText ?? `@${credit.username}`}</div>
      </div>
    </div>
  );
}
