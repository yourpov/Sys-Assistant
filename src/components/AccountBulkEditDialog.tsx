import { motion }   from 'framer-motion';
import { useState } from 'react';

import { ACCOUNT_REGIONS } from '../constants/accountRegions';
import { Autocomplete } from './Autocomplete';

const ACCESS_FA  = true;
const ACCESS_NFA = false;
const REGION_NONE = '';

export interface BulkEditChanges {
  fullAccess?: boolean;
  region    ?: string | null;
  category  ?: string | null;
  notes     ?: string | null;
}

interface Props {
  count             : number;
  existingCategories: string[];
  saving            : boolean;
  onSave            : (changes: BulkEditChanges) => void;
  onCancel          : () => void;
}

export function AccountBulkEditDialog({ count, existingCategories, saving, onSave, onCancel }: Props) {
  const [changeAccess, setChangeAccess]     = useState(false);
  const [fullAccess, setFullAccess]         = useState(ACCESS_FA);
  const [changeRegion, setChangeRegion]     = useState(false);
  const [region, setRegion]                 = useState<string>(REGION_NONE);
  const [changeCategory, setChangeCategory] = useState(false);
  const [category, setCategory]             = useState('');
  const [changeNotes, setChangeNotes]       = useState(false);
  const [notes, setNotes]                   = useState('');

  const anyChange = changeAccess || changeRegion || changeCategory || changeNotes;
  const canSave   = !saving && anyChange;

  const submit = () => {
    const changes: BulkEditChanges = {};
    if (changeAccess)   changes.fullAccess = fullAccess;
    if (changeRegion)   changes.region     = region === REGION_NONE ? null : region;
    if (changeCategory) changes.category   = category.trim() === '' ? null : category.trim();
    if (changeNotes)    changes.notes      = notes.trim() === '' ? null : notes.trim();
    onSave(changes);
  };

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
        aria-labelledby = "account-bulk-edit-title"
        initial         = {{ opacity: 0, scale: 0.94, y: 8 }}
        animate         = {{ opacity: 1, scale: 1, y: 0 }}
        exit            = {{ opacity: 0, scale: 0.94, y: 8 }}
        transition      = {{ duration: 0.18, ease: [0.2, 0.9, 0.3, 1.2] }}
      >
        <h2 id = "account-bulk-edit-title" data-tauri-drag-region>
          Edit {count} account{count === 1 ? '' : 's'}
        </h2>
        <p className = "account-bulk-edit-hint">Only the fields you tick are applied to every selected account.</p>

        <div className = "add-account-field">
          <label className = "account-bulk-edit-toggle">
            <input type = "checkbox" className = "settings-checkbox" checked = {changeAccess} onChange = {(e) => setChangeAccess(e.target.checked)} />
            <span>Access</span>
          </label>
          <div className = {`tools-subsection-pill-bar add-account-access-toggle${changeAccess ? '' : ' account-bulk-edit-field--disabled'}`} role = "group" aria-label = "Account access type">
            <button type = "button" className = {`tools-subsection-pill${fullAccess === ACCESS_FA ? ' active' : ''}`} onClick = {() => { setChangeAccess(true); setFullAccess(ACCESS_FA); }} aria-pressed = {fullAccess === ACCESS_FA}>
              FA
            </button>
            <button type = "button" className = {`tools-subsection-pill${fullAccess === ACCESS_NFA ? ' active' : ''}`} onClick = {() => { setChangeAccess(true); setFullAccess(ACCESS_NFA); }} aria-pressed = {fullAccess === ACCESS_NFA}>
              NFA
            </button>
          </div>
        </div>

        <div className = "add-account-field">
          <label className = "account-bulk-edit-toggle">
            <input type = "checkbox" className = "settings-checkbox" checked = {changeRegion} onChange = {(e) => setChangeRegion(e.target.checked)} />
            <span>Region</span>
          </label>
          <div className = {`tools-subsection-pill-bar add-account-region-toggle${changeRegion ? '' : ' account-bulk-edit-field--disabled'}`} role = "group" aria-label = "Account region">
            <button type = "button" className = {`tools-subsection-pill${region === REGION_NONE ? ' active' : ''}`} onClick = {() => { setChangeRegion(true); setRegion(REGION_NONE); }} aria-pressed = {region === REGION_NONE}>
              None
            </button>
            {ACCOUNT_REGIONS.map((r) => (
              <button key = {r} type = "button" className = {`tools-subsection-pill${region === r ? ' active' : ''}`} onClick = {() => { setChangeRegion(true); setRegion(r); }} aria-pressed = {region === r}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className = "add-account-field">
          <label className = "account-bulk-edit-toggle">
            <input type = "checkbox" className = "settings-checkbox" checked = {changeCategory} onChange = {(e) => setChangeCategory(e.target.checked)} />
            <span>Category</span>
          </label>
          <div className = {changeCategory ? undefined : 'account-bulk-edit-field--disabled'}>
            <Autocomplete
              value       = {category}
              onChange    = {(value) => { setChangeCategory(true); setCategory(value); }}
              options     = {existingCategories}
              placeholder = "Leave blank to clear the category"
            />
          </div>
        </div>

        <div className = "add-account-field">
          <label className = "account-bulk-edit-toggle">
            <input type = "checkbox" className = "settings-checkbox" checked = {changeNotes} onChange = {(e) => setChangeNotes(e.target.checked)} />
            <span>Notes</span>
          </label>
          <textarea
            className   = {changeNotes ? undefined : 'account-bulk-edit-field--disabled'}
            value       = {notes}
            onChange    = {(e) => { setChangeNotes(true); setNotes(e.target.value); }}
            placeholder = "Leave blank to clear notes on every selected account"
            rows        = {2}
          />
        </div>

        <div    className = "dialog-actions">
        <button className = "dialog-cancel" onClick = {onCancel}>
            Cancel
          </button>
          <button className = "dialog-confirm" onClick = {submit} disabled = {!canSave}>
            {saving ? 'Saving...' : `Apply to ${count}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
