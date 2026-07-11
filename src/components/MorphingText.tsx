import { useEffect, useRef, useState } from 'react';

import { useMotionPreference } from '../hooks/useMotionPreference';

const DISPLAY_MS    = 2200;
const TRANSITION_MS = 450;

interface MorphingTextProps {
  texts     : string[];
  className?: string;
}

export function MorphingText({ texts, className }: MorphingTextProps) {
  const reduceMotion          = useMotionPreference();
  const [index, setIndex]     = useState(0);
  const [visible, setVisible] = useState(true);
  const transitionRef         = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reduceMotion || texts.length <= 1) return;

    const interval = setInterval(() => {
      setVisible(false);
      transitionRef.current = setTimeout(() => {
        setIndex((i) => (i + 1) % texts.length);
        setVisible(true);
      }, TRANSITION_MS);
    }, DISPLAY_MS + TRANSITION_MS);

    return () => {
      clearInterval(interval);
      if (transitionRef.current) clearTimeout(transitionRef.current);
    };
  }, [reduceMotion, texts.length]);

  return (
    <div className = {`relative text-center ${className ?? ''}`}>
      <span
        className = "inline-block transition-all ease-in-out"
        style     = {reduceMotion ? undefined : {
          transitionDuration: `${TRANSITION_MS}ms`,
          opacity           : visible ? 1          : 0,
          filter            : visible ? 'blur(0px)': 'blur(4px)',
        }}
      >
        {texts[index]}
      </span>
    </div>
  );
}