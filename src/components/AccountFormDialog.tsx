import { motion } from 'framer-motion';
import { useState } from 'react';

interface Props {
  mode: 'add' | 'edit';
  initialLabel?: string;
  initialUsername?: string;
  error: string | null;
  saving: boolean;
  onSave: (label: string, username: string, password: string) => void;
  onCancel: () => void;
}

export function AccountFormDialog({ mode, initialLabel = '', initialUsername = '', error, saving, onSave, onCancel }: Props) {
  const [label, setLabel] = useState(initialLabel);
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const canSave = !saving && label.trim() !== '' && username.trim() !== '' && (mode === 'edit' || password !== '');

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
        className="dialog add-account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-form-title"
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0.9, 0.3, 1.2] }}
      >
        <h2 id="account-form-title" data-tauri-drag-region>
          {mode === 'add' ? 'Add account' : 'Edit account'}
        </h2>

        {error && <p className="settings-error">{error}</p>}

        <label className="add-account-field">
          <span>Display#name</span>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Main" autoFocus />
        </label>

        <label className="add-account-field">
          <span>Username</span>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="riot username" />
        </label>

        <label className="add-account-field">
          <span>Password</span>
          <div className="add-account-password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'edit' ? 'Leave blank to keep the current password' : 'riot password'}
            />
            <button
              type="button"
              className="add-account-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </label>

        <div className="dialog-actions">
          <button className="dialog-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="dialog-confirm" onClick={() => onSave(label.trim(), username.trim(), password)} disabled={!canSave}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
