import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useEffect, useRef, useState } from 'react';

import { listAccounts } from '../api/accounts';
import { findFilePath, getSettings, saveSettings } from '../api/settings';
import { MANUAL_ACTIONS } from '../constants/manualActions';
import { useMouseGlow } from '../hooks/useMouseGlow';
import type { Account, ManualAction, Settings } from '../types';
import { BASE_WINDOW_SIZE, tweenWindowSize } from '../utils/windowSize';
import { Skeleton } from './Skeleton';

const appWindow = getCurrentWindow();

const EXPANDED_WINDOW_SIZE = { width: 760, height: 760 };
const SAVE_DEBOUNCE_MS = 400;

const DEFAULT_SETTINGS: Settings = {
  tempValWaitSecs: 10,
  seshWaitSecs: 10,
  emuPath: null,
  loaderPath: null,
  seshPath: null,
  isAlwaysOnTop: false,
  insertSimEnabled: false,
  insertSimKeybind: null,
  manualActionsEnabled: ['toggleValorant', 'toggleRiotClient', 'openLoader', 'changeSeed'],
  accountSwapPool: [],
  henrikApiKeys: [],
};

const HENRIK_DASHBOARD_URL = 'https://api.henrikdev.xyz/dashboard/';

interface SectionProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

export function SettingsPage() {
  const glowRef = useMouseGlow<HTMLElement>();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    tweenWindowSize(EXPANDED_WINDOW_SIZE.width, EXPANDED_WINDOW_SIZE.height);
    return () => {
      tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height);
    };
  }, []);

  const pendingSave = useRef<Settings | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSave = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const toSave = pendingSave.current;
    if (!toSave) return;
    pendingSave.current = null;
    saveSettings(toSave)
      .then(() => setError(null))
      .catch((e) => setError(String(e)));
  };

  useEffect(() => flushSave, []);

  const update = (next: Settings) => {
    setSettings(next);
    pendingSave.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  };

  const resetToDefaults = () => {
    appWindow.setAlwaysOnTop(DEFAULT_SETTINGS.isAlwaysOnTop);
    update({ ...DEFAULT_SETTINGS });
  };

  if (!settings) {
    return (
      <main className="settings-page" data-tauri-drag-region ref={glowRef}>
        <div className="settings-content" data-tauri-drag-region>
          <div className="settings-header" data-tauri-drag-region>
            <Skeleton width={80} height={20} />
          </div>
          <div className="settings-grid" data-tauri-drag-region>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-section" data-tauri-drag-region>
                <Skeleton width={100} height={11} />
                <Skeleton height={13} />
                <Skeleton height={13} width="80%" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="settings-page" data-tauri-drag-region ref={glowRef}>
      <div className="settings-content" data-tauri-drag-region>
        <div className="settings-header" data-tauri-drag-region>
          <h2 data-tauri-drag-region>Settings</h2>
          <button type="button" className="manual-control-button" onClick={resetToDefaults}>
            Reset
          </button>
        </div>

        {error && <p className="settings-error">{error}</p>}

        <div className="settings-grid" data-tauri-drag-region>
          <AlwaysOnTopSection settings={settings} onChange={update} />
          <TimingSection settings={settings} onChange={update} />
          <FileLocationsSection settings={settings} onChange={update} />
          <InsertKeySimulatorSection settings={settings} onChange={update} />
          <ManualOptionsSection settings={settings} onChange={update} />
          <AccountSwapSection settings={settings} onChange={update} />
          <HenrikApiKeySection settings={settings} onChange={update} />
        </div>
      </div>
    </main>
  );
}

function AlwaysOnTopSection({ settings, onChange }: SectionProps) {
  const toggle = () => {
    const next = !settings.isAlwaysOnTop;
    appWindow.setAlwaysOnTop(next);
    onChange({ ...settings, isAlwaysOnTop: next });
  };

  return (
    <div className="settings-section" data-tauri-drag-region>
      <label className="settings-checkbox-row" htmlFor="always-on-top">
        <input id="always-on-top" type="checkbox" className="settings-checkbox" checked={settings.isAlwaysOnTop} onChange={toggle} />
        <span>Always on top</span>
      </label>
    </div>
  );
}

function TimingSection({ settings, onChange }: SectionProps) {
  return (
    <div className="settings-section" data-tauri-drag-region>
      <label className="settings-slider-label" htmlFor="temp-val-wait">
        <span>How long VALORANT stays open during temp open step (Hamad Method)</span>
        <span className="settings-slider-value">{settings.tempValWaitSecs}s</span>
      </label>
      <input
        id="temp-val-wait"
        type="range"
        min={0}
        max={30}
        value={settings.tempValWaitSecs}
        onChange={(e) => onChange({ ...settings, tempValWaitSecs: Number(e.target.value) })}
      />

      <label className="settings-slider-label" htmlFor="sesh-wait">
        <span>How long to wait before starting the session when VALORANT opens (Hamad Method)</span>
        <span className="settings-slider-value">{settings.seshWaitSecs}s</span>
      </label>
      <input
        id="sesh-wait"
        type="range"
        min={0}
        max={30}
        value={settings.seshWaitSecs}
        onChange={(e) => onChange({ ...settings, seshWaitSecs: Number(e.target.value) })}
      />
    </div>
  );
}

type PathKey = 'emuPath' | 'loaderPath' | 'seshPath';

interface PathRow {
  key: PathKey;
  label: string;
  filename: string;
}

const PATH_ROWS: PathRow[] = [
  { key: 'emuPath', label: 'Emu installer', filename: 'emu_installer.exe' },
  { key: 'loaderPath', label: 'Loader', filename: 'ldr.novgk.exe' },
  { key: 'seshPath', label: 'Session', filename: 'sesh.exe' },
];

function FileLocationsSection({ settings, onChange }: SectionProps) {
  const browseFor = async (key: PathKey, filename: string) => {
    const knownPath = settings[key] ?? (await findFilePath(filename));
    const defaultPath = knownPath?.replace(/[\\/][^\\/]*$/, '');
    const picked = await open({
      multiple: false,
      filters: [{ name: 'Executable', extensions: ['exe'] }],
      title: `Locate ${filename}`,
      defaultPath,
    });
    if (typeof picked === 'string') {
      onChange({ ...settings, [key]: picked });
    }
  };

  const clearPath = (key: PathKey) => {
    onChange({ ...settings, [key]: null });
  };

  return (
    <div className="settings-section" data-tauri-drag-region>
      <span className="settings-section-label">File locations</span>
      {PATH_ROWS.map(({ key, label, filename }) => (
        <div key={key} className="settings-path-row" data-tauri-drag-region>
          <div className="settings-path-text" data-tauri-drag-region>
            <span className="settings-path-label">{label}</span>
            <span className="settings-path-value">{settings[key] ?? `Auto-detect (${filename})`}</span>
          </div>
          <div className="settings-path-actions" data-tauri-drag-region>
            <button type="button" className="settings-button" onClick={() => browseFor(key, filename)}>
              Browse
            </button>
            {settings[key] && (
              <button type="button" className="settings-button" onClick={() => clearPath(key)}>
                Clear
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const MODIFIER_CODES = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);

const KEY_LABELS: Record<string, string> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
};

function keyLabel(code: string): string {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

function InsertKeySimulatorSection({ settings, onChange }: SectionProps) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === 'Escape') {
        setRecording(false);
        return;
      }
      if (MODIFIER_CODES.has(e.code)) return;

      onChange({ ...settings, insertSimKeybind: e.code });
      setRecording(false);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recording, settings, onChange]);

  const toggleEnabled = () => {
    onChange({ ...settings, insertSimEnabled: !settings.insertSimEnabled });
  };

  const clearKeybind = () => {
    onChange({ ...settings, insertSimKeybind: null });
  };

  return (
    <div className="settings-section" data-tauri-drag-region>
      <span className="settings-section-label">Insert key simulator</span>

      <label className="settings-checkbox-row" htmlFor="insert-sim-enabled">
        <input id="insert-sim-enabled" type="checkbox" className="settings-checkbox" checked={settings.insertSimEnabled} onChange={toggleEnabled} />
        <span>Enable keybind</span>
      </label>

      <p className="settings-hint">Pressing this key simulates Insert.</p>

      <div className="settings-path-row" data-tauri-drag-region>
        <span className="settings-path-label">Keybind</span>
        <div className="settings-path-actions" data-tauri-drag-region>
          <button type="button" className={`keybind-box${recording ? ' listening' : ''}`} onClick={() => setRecording(true)}>
            {recording ? '...' : settings.insertSimKeybind ? keyLabel(settings.insertSimKeybind) : ''}
          </button>
          {settings.insertSimKeybind && (
            <button type="button" className="settings-button" onClick={clearKeybind}>
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ManualOptionsSection({ settings, onChange }: SectionProps) {
  const toggleAction = (action: ManualAction) => {
    const enabled = settings.manualActionsEnabled.includes(action)
      ? settings.manualActionsEnabled.filter((a) => a !== action)
      : [...settings.manualActionsEnabled, action];
    onChange({ ...settings, manualActionsEnabled: enabled });
  };

  return (
    <div className="settings-section" data-tauri-drag-region>
      <span className="settings-section-label">Manual options</span>
      <p className="settings-hint">
        Choose which steps show under "Manual options" on the Automate page.
      </p>

      <div className="settings-checkbox-grid" data-tauri-drag-region>
        {MANUAL_ACTIONS.map(({ action, label, hint }) => (
          <label key={action} className="settings-checkbox-row" htmlFor={`manual-action-${action}`} title={hint}>
            <input
              id={`manual-action-${action}`}
              type="checkbox"
              className="settings-checkbox"
              checked={settings.manualActionsEnabled.includes(action)}
              onChange={() => toggleAction(action)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function AccountSwapSection({ settings, onChange }: SectionProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const toggleAccount = (id: string) => {
    const pool = settings.accountSwapPool.includes(id)
      ? settings.accountSwapPool.filter((a) => a !== id)
      : [...settings.accountSwapPool, id];
    onChange({ ...settings, accountSwapPool: pool });
  };

  const description =
    settings.accountSwapPool.length === 0
      ? 'Pick one or more accounts below for the Account Swap automate option to use.'
      : settings.accountSwapPool.length === 1
        ? 'With one account checked, Account Swap always signs in to that same account.'
        : `With ${settings.accountSwapPool.length} accounts checked, Account Swap signs in to a different one each time.`;

  return (
    <div className="settings-section" data-tauri-drag-region>
      <span className="settings-section-label">Account swap</span>
      <p className="settings-hint">{description}</p>

      {accounts.length === 0 ? (
        <p className="settings-hint">No saved accounts yet. Add one on the Accounts page first.</p>
      ) : (
        <div className="settings-scroll-list" data-tauri-drag-region>
          {accounts.map((account) => (
            <label key={account.id} className="settings-checkbox-row" htmlFor={`account-swap-${account.id}`} title={account.label}>
              <input
                id={`account-swap-${account.id}`}
                type="checkbox"
                className="settings-checkbox"
                checked={settings.accountSwapPool.includes(account.id)}
                onChange={() => toggleAccount(account.id)}
              />
              <span>{account.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function HenrikApiKeySection({ settings, onChange }: SectionProps) {
  const keys = settings.henrikApiKeys.length > 0 ? settings.henrikApiKeys : [''];

  const updateKey = (index: number, value: string) => {
    const next = [...keys];
    next[index] = value;
    onChange({ ...settings, henrikApiKeys: next });
  };

  const removeKey = (index: number) => {
    onChange({ ...settings, henrikApiKeys: keys.filter((_, i) => i !== index) });
  };

  const addKey = () => {
    onChange({ ...settings, henrikApiKeys: [...keys, ''] });
  };

  return (
    <div className="settings-section" data-tauri-drag-region>
      <span className="settings-section-label">API keys</span>
      <p className="settings-hint">Needed for lookups in Tools. More keys you add the less rate limits.</p>

      <div className="settings-key-list" data-tauri-drag-region>
        {keys.map((key, index) => (
          <div key={index} className="settings-key-row" data-tauri-drag-region>
            <span className="settings-key-number">{index + 1}</span>
            <input
              type="text"
              className="tools-input settings-key-input"
              placeholder="HDEV-..."
              value={key}
              onChange={(e) => updateKey(index, e.target.value)}
            />
            <button
              type="button"
              className="settings-key-remove"
              onClick={() => removeKey(index)}
              disabled={keys.length === 1 && !key}
              aria-label="Remove this key"
              title="Remove this key"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="settings-path-actions" data-tauri-drag-region>
        <button type="button" className="settings-button" onClick={addKey}>
          + Add another key
        </button>
        <button type="button" className="settings-button" onClick={() => openUrl(HENRIK_DASHBOARD_URL)}>
          Get a free key
        </button>
      </div>
    </div>
  );
}
