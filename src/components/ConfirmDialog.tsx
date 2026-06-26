import { motion } from 'framer-motion';

type Tone = 'warning' | 'danger';

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel?: () => void;
  tone?: Tone;
}

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel, tone = 'warning' }: Props) {
  return (
    <motion.div
      className="dialog-backdrop"
      data-tauri-drag-region
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <motion.div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0.9, 0.3, 1.2] }}
      >
        <div className="dialog-heading" data-tauri-drag-region>
          <ToneIcon tone={tone} />
          <h2 id="dialog-title">{title}</h2>
        </div>
        <p data-tauri-drag-region>{body}</p>
        <div className="dialog-actions">
          {onCancel && (
            <button className="dialog-cancel" onClick={onCancel}>
              Nevermind
            </button>
          )}
          <button className="dialog-confirm" onClick={onConfirm} autoFocus={!onCancel}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ToneIcon({ tone }: { tone: Tone }) {
  const className = `dialog-icon dialog-icon-${tone}`;
  if (tone === 'danger') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M9 9L15 15M15 9L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3L22 20H2L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}
