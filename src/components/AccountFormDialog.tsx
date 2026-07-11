import { motion }   from 'framer-motion';
import { useState } from 'react';

import type { UserFacingError } from '../utils/userError';
import { ErrorDisplay } from './ErrorDisplay';
import { Tooltip } from './Tooltip';

const ACCESS_FA  = true;
const ACCESS_NFA = false;

interface Props {
              mode            : 'add' | 'edit';
  initialLabel ?               : string;
              initialUsername?: string;
              initialNotes   ?: string;
              initialFullAccess?: boolean;
              error           : UserFacingError | null;
              saving          : boolean;
              onSave          : (label: string, username: string, password: string, notes: string, fullAccess: boolean) => void;
              onCancel        : () => void;
}

export function AccountFormDialog({
  mode,
  initialLabel = '',
  initialUsername = '',
  initialNotes = '',
  initialFullAccess = ACCESS_FA,
  error,
  saving,
  onSave,
  onCancel,
}: Props) {
  const [label, setLabel]               = useState(initialLabel);
  const [username, setUsername]         = useState(initialUsername);
  const [password, setPassword]         = useState('');
  const [notes, setNotes]               = useState(initialNotes);
  const [fullAccess, setFullAccess]     = useState(initialFullAccess);
  const [showPassword, setShowPassword] = useState(false);

  const labelOk = !fullAccess || label.trim() !== '';
  const canSave = !saving && labelOk && username.trim() !== '' && (mode === 'edit' || password !== '');

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
        className       = "dialog add-account-dialog"
        role            = "dialog"
        aria-modal      = "true"
        aria-labelledby = "account-form-title"
        initial         = {{ opacity: 0, scale: 0.94, y: 8 }}
        animate         = {{ opacity: 1, scale: 1, y: 0 }}
        exit            = {{ opacity: 0, scale: 0.94, y: 8 }}
        transition      = {{ duration: 0.18, ease: [0.2, 0.9, 0.3, 1.2] }}
      >
        <h2 id = "account-form-title" data-tauri-drag-region>
          {mode === 'add' ? 'Add account' : 'Edit account'}
        </h2>

        {error && <ErrorDisplay error = {error} />}

        <div className = "add-account-field">
          <span>Access</span>
          <div className = "tools-subsection-pill-bar add-account-access-toggle" role = "group" aria-label = "Account access type">
            <button
              type      = "button"
              className = {`tools-subsection-pill${fullAccess === ACCESS_FA ? ' active' : ''}`}
              onClick   = {() => setFullAccess(ACCESS_FA)}
              aria-pressed = {fullAccess === ACCESS_FA}
            >
              FA
            </button>
            <button
              type      = "button"
              className = {`tools-subsection-pill${fullAccess === ACCESS_NFA ? ' active' : ''}`}
              onClick   = {() => setFullAccess(ACCESS_NFA)}
              aria-pressed = {fullAccess === ACCESS_NFA}
            >
              NFA
            </button>
          </div>
        </div>

        <label className = "add-account-field">
          <span>{fullAccess ? 'Display#name' : 'Display#name (optional)'}</span>
          <input type = "text" value = {label} onChange = {(e) => setLabel(e.target.value)} placeholder = "Main" autoFocus />
        </label>

        <label className = "add-account-field">
          <span>Username</span>
          <input type = "text" value = {username} onChange = {(e) => setUsername(e.target.value)} placeholder = "riot username" />
        </label>

        <label className = "add-account-field">
          <span>Password</span>
          <div className = "add-account-password-wrapper">
            <input
              type        = {showPassword ? 'text' : 'password'}
              value       = {password}
              onChange    = {(e) => setPassword(e.target.value)}
              placeholder = {mode === 'edit' ? 'Leave blank to keep the current password' : 'riot password'}
            />
            <Tooltip content = {showPassword ? 'Hide password' : 'Show password'}>
              <button
                type       = "button"
                className  = "add-account-password-toggle"
                onClick    = {() => setShowPassword((prev) => !prev)}
                aria-label = {showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </Tooltip>
          </div>
        </label>

        <label className = "add-account-field">
          <span>Notes (optional)</span>
          <textarea
            value       = {notes}
            onChange    = {(e) => setNotes(e.target.value)}
            placeholder = "e.g. smurf, main, rank ready"
            rows        = {2}
          />
        </label>

        <div    className = "dialog-actions">
        <button className = "dialog-cancel" onClick = {onCancel}>
            Cancel
          </button>
          <button
            className = "dialog-confirm"
            onClick   = {() => onSave(label.trim(), username.trim(), password, notes.trim(), fullAccess)}
            disabled  = {!canSave}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox = "0 0 24 24" fill = "none" aria-hidden = "true">
      <path
        d              = "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke         = "currentColor"
        strokeWidth    = "1.6"
        strokeLinejoin = "round"
      />
      <circle cx = "12" cy = "12" r = "3" stroke = "currentColor" strokeWidth = "1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox = "0 0 24 24" fill = "none" aria-hidden = "true">
      <path
        d              = "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke         = "currentColor"
        strokeWidth    = "1.6"
        strokeLinejoin = "round"
      />
      <circle cx = "12" cy             = "12" r                     = "3" stroke          = "currentColor" strokeWidth = "1.6" />
      <path   d  = "M3 3L21 21" stroke = "currentColor" strokeWidth = "1.6" strokeLinecap = "round" />
    </svg>
  );
}
