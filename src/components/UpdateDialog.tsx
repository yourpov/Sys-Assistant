import { motion } from 'framer-motion';

import type { UserFacingError } from '../utils/userError';
import { ErrorDisplay } from './ErrorDisplay';

interface Props {
  version  : string;
  notes    : string | null;
  status   : 'available' | 'downloading' | 'relaunching' | 'error';
  progress : number;
  error    : UserFacingError | null;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateDialog({ version, notes, status, progress, error, onInstall, onDismiss }: Props) {
  return (
    <motion.div
      className = "dialog-backdrop"
      data-tauri-drag-region
      initial    = {{ opacity: 0 }}
      animate    = {{ opacity: 1 }}
      exit       = {{ opacity: 0 }}
      transition = {{ duration: 0.16 }}
    >
      <motion.div
        className       = "dialog"
        role            = "alertdialog"
        aria-modal      = "true"
        aria-labelledby = "update-dialog-title"
        initial         = {{ opacity: 0, scale: 0.94, y: 8 }}
        animate         = {{ opacity: 1, scale: 1, y: 0 }}
        exit            = {{ opacity: 0, scale: 0.94, y: 8 }}
        transition      = {{ duration: 0.18, ease: [0.2, 0.9, 0.3, 1.2] }}
      >
        <div className = "dialog-heading" data-tauri-drag-region>
        <h2  id        = "update-dialog-title">Update available: v{version}</h2>
        </div>
        {notes && <p data-tauri-drag-region className="update-dialog-notes">{notes}</p>}

        {status === 'downloading' && (
          <div className = "update-progress-track">
          <div className = "update-progress-fill" style = {{ width: `${progress}%` }} />
          </div>
        )}
        {status === 'relaunching' && <p data-tauri-drag-region>Installed. Restarting...</p>}
        {status === 'error' && error && <ErrorDisplay error = {error} onRetry = {onInstall} />}

        <div className = "dialog-actions">
          {status === 'available' && (
            <button className = "dialog-cancel" onClick = {onDismiss}>
              Later
            </button>
          )}
          <button className = "dialog-confirm" onClick = {onInstall} disabled = {status === 'downloading' || status === 'relaunching'} autoFocus>
            {status === 'downloading' ? `Downloading... ${progress}%` : status === 'relaunching' ? 'Restarting...' : status === 'error' ? 'Try again' : 'Update now'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
