import { motion }              from 'framer-motion';
import { useEffect, useState } from 'react';

import type { ToastData } from '../hooks/useToastStore';

const RELATIVE_TIME_REFRESH = 60_000;

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

interface Props {
  data     : ToastData;
  index    : number;
  onDismiss: (id: string) => void;
}

export function NotificationItem({ data, index, onDismiss }: Props) {
  const [time, setTime] = useState(() => relativeTime(data.timestamp));

  useEffect(() => {
    const id = setInterval(() => setTime(relativeTime(data.timestamp)), RELATIVE_TIME_REFRESH);
    return () => clearInterval(id);
  }, [data.timestamp]);

  return (
    <motion.div
      layout
      initial   = {{ opacity: 0, x: 40 }}
      animate   = {{ opacity: 1, x: 0, transition: { delay: index * 0.04 } }}
      exit      = {{ opacity: 0, scale: 0.82, filter: 'blur(4px)', transition: { duration: 0.18, delay: index * 0.025, ease: 'easeIn' } }}
      className = {`notification-item notification-item-${data.icon}${data.read ? ' read' : ''}`}
    >
      <NotificationIcon icon      = {data.icon} />
      <div              className = "notification-item-body">
      <p                className = "notification-item-title">{data.title}</p>
        {data.body && <p className="notification-item-message">{data.body}</p>}
        <div  className = "notification-item-footer">
        <span className = "notification-item-time">{time}</span>
          {data.decision && (
            <span className = {`notification-item-decision${data.decision.accepted ? ' accepted' : ''}`}>{data.decision.label}</span>
          )}
        </div>
      </div>
      <button type    = "button" className            = "notification-item-dismiss" onClick = {() => onDismiss(data.id)} aria-label = "Remove notification">
      <svg    viewBox = "0 0 24 24" fill              = "none" aria-hidden                  = "true">
      <path   d       = "M6 6L18 18M18 6L6 18" stroke = "currentColor" strokeWidth          = "2" strokeLinecap                     = "round" />
        </svg>
      </button>
      {!data.read && <span className="notification-item-unread-dot" />}
    </motion.div>
  );
}

function NotificationIcon({ icon }: { icon: ToastData['icon'] }) {
  const className = `notification-item-icon notification-item-icon-${icon}`;
  if (icon === 'success') {
    return (
      <svg    className = {className} viewBox              = "0 0 24 24" fill           = "none" aria-hidden  = "true">
      <circle cx        = "12" cy                          = "12" r                     = "9" stroke          = "currentColor" strokeWidth = "1.6" />
      <path   d         = "M8.5 12.5l2.5 2.5 4.5-5" stroke = "currentColor" strokeWidth = "1.6" strokeLinecap = "round" strokeLinejoin     = "round" />
      </svg>
    );
  }
  if (icon === 'error') {
    return (
      <svg    className = {className} viewBox                 = "0 0 24 24" fill           = "none" aria-hidden  = "true">
      <circle cx        = "12" cy                             = "12" r                     = "9" stroke          = "currentColor" strokeWidth = "1.6" />
      <path   d         = "M9.5 9.5l5 5M14.5 9.5l-5 5" stroke = "currentColor" strokeWidth = "1.6" strokeLinecap = "round" />
      </svg>
    );
  }
  if (icon === 'warning') {
    return (
      <svg    className = {className} viewBox                = "0 0 24 24" fill           = "none" aria-hidden   = "true">
      <path   d         = "M12 3.5L21 19.5H3L12 3.5Z" stroke = "currentColor" strokeWidth = "1.6" strokeLinejoin = "round" />
      <path   d         = "M12 10V13.5" stroke               = "currentColor" strokeWidth = "1.6" strokeLinecap  = "round" />
      <circle cx        = "12" cy                            = "16.3" r                   = "0.9" fill           = "currentColor" />
      </svg>
    );
  }
  return (
    <svg    className = {className} viewBox            = "0 0 24 24" fill           = "none" aria-hidden  = "true">
    <circle cx        = "12" cy                        = "12" r                     = "9" stroke          = "currentColor" strokeWidth = "1.6" />
    <path   d         = "M12 8.3V8.31M12 11V16" stroke = "currentColor" strokeWidth = "1.6" strokeLinecap = "round" />
    </svg>
  );
}
