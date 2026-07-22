import { getCurrentWindow }                                                                                           from '@tauri-apps/api/window';
import { open }                                                                                                       from '@tauri-apps/plugin-dialog';
import { isPermissionGranted, requestPermission }                                                                     from '@tauri-apps/plugin-notification';
import { openUrl }                                                                                                    from '@tauri-apps/plugin-opener';
import { AnimatePresence, motion }                                                                                    from 'framer-motion';
import { Fragment, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import { listAccounts }                            from '../api/accounts';
import { fetchChangelog }                          from '../api/changelog';
import { getAppCredit }                            from '../api/credit';
import { submitFeedback, type FeedbackKind }       from '../api/feedback';
import { findFilePath, getSettings, saveSettings } from '../api/settings';
import { checkVanguardTraces, restartComputer, uninstallVanguard } from '../api/workflow';
import { VANGUARD_REINSTALL_FLAG }                  from '../constants/vanguard';
import { MANUAL_ACTIONS }                          from '../constants/manualActions';
import {
  CLIPBOARD_ACK_MS,
  SETTINGS_SAVE_DEBOUNCE_MS,
} from '../constants/timing';
import { GITHUB_URL, GUIDES_URL, HENRIK_DASHBOARD_URL }                 from '../constants/urls';
import { SETTINGS_WINDOW_SIZE }                                         from '../constants/windowSizes';

import { setOsNotifications, toast }                                    from '../hooks/useToastStore';
import type { Account, AppCredit, ManualAction, Settings, SettingsTab } from '../types';
import { accountAvatarInitial, displayUsername }                        from '../utils/accountDisplay';
import { parseInvokeError, toastFromError, userError, type UserFacingError } from '../utils/userError';
import { ErrorDisplay }                                               from './ErrorDisplay';
import { confirmIfEnabled }                                             from '../utils/confirmGate';
import { logSilentFailure }                                             from '../utils/silentError';
import { readPersistedRecord, writePersistedRecord }                    from '../utils/persistedRecord';
import { syncAccentColor }                                              from '../utils/accentColorPreference';
import { syncMuteAlertSounds }                                          from '../utils/alertSoundPreference';
import { normalizeHex }                                                 from '../utils/color';
import { syncReduceMotion }                                             from '../utils/motionPreference';
import { BASE_WINDOW_SIZE, tweenWindowSize }                            from '../utils/windowSize';
import { AppLogModal }                                                  from './AppLogModal';
import { ColorWheelPicker }                                             from './ColorWheelPicker';
import { PageHero }                                                     from './PageHero';
import { Skeleton }                                                     from './Skeleton';
import { Tooltip }                                                      from './Tooltip';
import { TransparencySection }                                          from './TransparencySection';

const appWindow = getCurrentWindow();

const STATUS_LABELS: Record<string, string> = {
  online : 'Online',
  idle   : 'Idle',
  dnd    : 'Do Not Disturb',
  offline: 'Offline',
};

const DEFAULT_SETTINGS: Settings = {
  emuPath                      : null,
  loaderPath                   : null,
  tracexPath                   : null,
  tracexTuiPath                : null,
  tracexUseTui                 : false,
  isAlwaysOnTop                : false,
  insertSimEnabled             : false,
  insertSimKeybind             : null,
  manualActionsEnabled         : ['toggleValorant', 'toggleRiotClient', 'openTraceX', 'changeSeed'],
  accountSwapPool              : [],
  henrikApiKeys                : [],
  autoRunLoaderEnabled         : true,
  autoRunLoaderOnValorant      : false,
  toastOsNotificationsEnabled  : false,
  confirmBeforeActionsEnabled  : false,
  hideAccountUsernames         : true,
  reduceAnimationsEnabled      : false,
  muteAlertSoundsEnabled       : false,
  accentColor                  : null,
};

const SETTINGS_TABS: readonly SettingsTab[] = ['General', 'Automation', 'Tools', 'About'];

interface SettingsSectionProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

const TAB_HINTS: Record<SettingsTab, string> = {
  General   : 'Window, notifications, and safety prompts',
  Automation: 'Methods, manual steps, in-game controls, and file location',
  Tools     : 'External API keys',
  About     : 'Credits, transparency, feedback, and changelogs',
};

function SettingsPanel({
  title,
  hint,
  headerActions,
  children,
  className,
}: {
  title        ?: string;
  hint         ?: string;
  headerActions?: ReactNode;
  children      : ReactNode;
  className    ?: string;
}) {
  return (
    <section className = {`surface-card settings-panel${className ? ` ${className}` : ''}`} data-tauri-drag-region>
      {(title || headerActions) && (
        <div className = "settings-panel-head" data-tauri-drag-region>
          {title ? <span className="settings-panel-title">{title}</span> : null}
          {headerActions}
        </div>
      )}
      {hint ? <p className="settings-panel-hint">{hint}</p> : null}
      <div className = "settings-panel-body drag-surface">{children}</div>
    </section>
  );
}

const SETTINGS_GROUP_STATE_KEY = 'settings-group-state';

function loadGroupOpen(groupId: string, defaultOpen: boolean): boolean {
  return readPersistedRecord(SETTINGS_GROUP_STATE_KEY, groupId, defaultOpen);
}

function saveGroupOpen(groupId: string, open: boolean) {
  writePersistedRecord(SETTINGS_GROUP_STATE_KEY, groupId, open);
}

function SettingsChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className   = "settings-group-chevron"
      viewBox     = "0 0 24 24"
      fill        = "none"
      aria-hidden = "true"
      style       = {{ transform: expanded ? 'rotate(180deg)' : 'none' }}
    >
      <path d = "M6 9l6 6 6-6" stroke = "currentColor" strokeWidth = "2" strokeLinecap = "round" strokeLinejoin = "round" />
    </svg>
  );
}

function SettingsGroup({
  groupId,
  title,
  hint,
  children,
  defaultOpen = false,
}: {
  groupId     : string;
  title       : string;
  hint       ?: string;
  children    : ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(() => loadGroupOpen(groupId, defaultOpen));

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      saveGroupOpen(groupId, next);
      return next;
    });
  };

  const handleTogglePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  return (
    <section className = {`settings-group${open ? ' settings-group--open' : ' settings-group--collapsed'}`}>
      <button
        type          = "button"
        className     = "settings-group-toggle"
        onPointerDown = {handleTogglePointerDown}
        onClick       = {(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-expanded = {open}
      >
        <span className = "settings-group-head">
        <span className = "settings-group-title">{title}</span>
          {hint ? <p className="settings-group-hint">{hint}</p> : null}
        </span>
        <SettingsChevron expanded = {open} />
      </button>
      <div className = "settings-group-body" aria-hidden = {!open}>
      <div className = "settings-group-stack">{children}</div>
      </div>
    </section>
  );
}

interface SettingsPageProps {
  initialTab       ?                    : SettingsTab | null;
                   onInitialTabConsumed?: () => void;
  onOpenToolsMatch ?                    : () => void;
  onOpenScene      ?                    : () => void;
}

export function SettingsPage({ initialTab, onInitialTabConsumed, onOpenToolsMatch, onOpenScene }: SettingsPageProps = {}) {

  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError]       = useState<UserFacingError | null>(null);
  const [tab, setTab]           = useState<SettingsTab>(initialTab ?? 'General');

  useEffect(() => {
    if (!initialTab) return;
    setTab(initialTab);
    onInitialTabConsumed?.();
  }, [initialTab, onInitialTabConsumed]);

  useEffect(() => {
    getSettings()
      .then((loaded) => {
        syncReduceMotion(loaded.reduceAnimationsEnabled);
        syncMuteAlertSounds(loaded.muteAlertSoundsEnabled);
        syncAccentColor(loaded.accentColor);
        setSettings(loaded);
      })
      .catch((e) => setError(parseInvokeError(e)));
  }, []);

  useEffect(() => {
    tweenWindowSize(SETTINGS_WINDOW_SIZE.width, SETTINGS_WINDOW_SIZE.height);
    return () => {
      tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height);
    };
  }, []);

  const pendingSave = useRef<Settings | null>(null);
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      .catch((e) => setError(parseInvokeError(e)));
  };

  useEffect(() => () => {
    flushSave();
  }, []);

  const update = (next: Settings) => {
    syncReduceMotion(next.reduceAnimationsEnabled);
    syncMuteAlertSounds(next.muteAlertSoundsEnabled);
    syncAccentColor(next.accentColor);
    setSettings(next);
    pendingSave.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, SETTINGS_SAVE_DEBOUNCE_MS);
  };

  const resetToDefaults = async () => {
    if (!settings) return;
    const notice = { title: 'Reset all settings?', body: "This puts everything back to default, except your API keys.", icon: 'error' as const };
    if (!(await confirmIfEnabled(notice, 'Reset'))) return;
    appWindow.setAlwaysOnTop(DEFAULT_SETTINGS.isAlwaysOnTop);
    update({ ...DEFAULT_SETTINGS, henrikApiKeys: settings.henrikApiKeys });
  };

  if (!settings) {
    return (
      <main     className = "settings-page" data-tauri-drag-region>
      <div      className = "settings-content" data-tauri-drag-region>
      <Skeleton width     = {120} height                               = {20} />
      <Skeleton width     = "100%" height                              = {40} />
      <div      className = "settings-grid" data-tauri-drag-region>
            {Array.from({ length: 6 }).map((_, i) => (
              <div      key    = {i} className = "skeleton-section" data-tauri-drag-region>
              <Skeleton width  = {100} height  = {11} />
              <Skeleton height = {13} />
              <Skeleton height = {13} width    = "80%" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className = "settings-page" data-tauri-drag-region>
    <div  className = "settings-content" data-tauri-drag-region>
        <PageHero
          title    = "Settings"
          subtitle = "Grouped by what each setting is for"
          actions  = {
            <Tooltip content = "Reset all settings to their defaults">
            <button  type    = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {resetToDefaults}>
                Reset
              </button>
            </Tooltip>
          }
        />

        {error && <ErrorDisplay error = {error} className = "settings-error drag-surface" />}

        <div className = "app-tab-bar app-tab-bar--cols-4 drag-surface" role = "tablist" data-tauri-drag-region>
          {SETTINGS_TABS.map((id) => (
            <Tooltip key = {id} content = {TAB_HINTS[id]} block>
              <button
                type          = "button"
                role          = "tab"
                aria-selected = {id === tab}
                className     = {`app-tab-button${id === tab ? ' active' : ''}`}
                onClick       = {() => setTab(id)}
              >
                {id}
              </button>
            </Tooltip>
          ))}
        </div>

        <AnimatePresence mode = "wait">
          <motion.div
            key        = {tab}
            className  = "app-tab-panel settings-grid"
            initial    = {{ opacity: 0, y: 6 }}
            animate    = {{ opacity: 1, y: 0 }}
            exit       = {{ opacity: 0, y: -6, transition: { duration: 0.1 } }}
            transition = {{ duration: 0.18, ease: 'easeOut' }}
          >
            {tab === 'General' && (
              <>
                <SettingsGroup groupId  = "general-window" title = "Window" hint = "How this app looks on your desktop." defaultOpen>
                <WindowSection settings = {settings} onChange    = {update} />
                <PerformanceSection settings = {settings} onChange = {update} />
                <AccentColorSection settings = {settings} onChange = {update} />
                </SettingsGroup>
                <SettingsGroup        groupId  = "general-notifications" title = "Notifications" hint = "Alerts that appear outside the app window.">
                <NotificationsSection settings = {settings} onChange           = {update} />
                </SettingsGroup>
                <SettingsGroup        groupId  = "general-safety" title = "Safety" hint = "Extra confirmation before destructive or hard-to-undo actions.">
                <ConfirmationsSection settings = {settings} onChange    = {update} />
                </SettingsGroup>
                <SettingsGroup groupId = "general-maintenance" title = "Vanguard" hint = "Riot Vanguard Options.">
                  <VanguardSection />
                </SettingsGroup>
              </>
            )}
            {tab === 'Automation' && (
              <>
                <SettingsGroup        groupId  = "automation-start-process" title = "Start Process" hint = "What happens during Start Process and Account Swap." defaultOpen>
                <LoaderPromptSection  settings = {settings} onChange              = {update} />
                <TraceXVersionSection settings = {settings} onChange              = {update} />
                </SettingsGroup>
                <SettingsGroup       groupId  = "automation-loader" title = "Loader" hint = "Run the loader automatically when VALORANT is running.">
                <LoaderAutoRunSection settings = {settings} onChange       = {update} />
                </SettingsGroup>
                <SettingsGroup      groupId  = "automation-account-swap" title = "Account Swap" hint = "Which accounts rotate when you use this method.">
                <AccountSwapSection settings = {settings} onChange             = {update} />
                </SettingsGroup>
                <SettingsGroup        groupId  = "automation-manual" title = "Manual steps" hint = "Which options show in Manual steps on Automate.">
                <ManualOptionsSection settings = {settings} onChange       = {update} />
                </SettingsGroup>
                <SettingsGroup        groupId  = "automation-ingame" title = "In-game" hint = "Keybinds for in-game actions.">
                <InsertKeybindSection settings = {settings} onChange       = {update} />
                </SettingsGroup>
                <SettingsGroup        groupId  = "automation-paths" title = "Files Locations" hint = "Set the path of tracex, the loader, and the emu installer.">
                <FileLocationsSection settings = {settings} onChange      = {update} />
                </SettingsGroup>
              </>
            )}
            {tab === 'Tools' && (
              <SettingsGroup       groupId  = "tools-henrik" title = "HenrikDev API" hint = "Powers account lookup and match monitoring in the Tools tab." defaultOpen>
              <HenrikApiKeySection settings = {settings} onChange  = {update} />
              </SettingsGroup>
            )}
            {tab === 'About' && (
              <>
                <SettingsGroup groupId = "about-project" title = "Project" hint = "By the Sys-Info community, for the Sys-Info community." defaultOpen>
                  <CreditsSection onOpenScene = {onOpenScene} />
                  <GuidesSection />
                  <OpenSourceSection />
                </SettingsGroup>
                <SettingsGroup groupId = "about-feedback" title = "Feedback" hint = "Send suggestions or bug reports and read changelogs.">
                  <FeedbackSection />
                  <ChangelogSection />
                </SettingsGroup>
                <SettingsGroup
                  groupId = "about-transparency"
                  title   = "Transparency"
                  hint    = "What Private Assistant stores, sends, reads, writes, and changes on your PC."
                >
                  <TransparencySection onOpenToolsMatch = {onOpenToolsMatch} />
                </SettingsGroup>
                <SettingsGroup groupId = "about-developer" title = "Developer" hint = "Troubleshooting logs." defaultOpen>
                  <AppLogsSection />
                </SettingsGroup>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

function WindowSection({ settings, onChange }: SettingsSectionProps) {
  const toggle = () => {
    const next = !settings.isAlwaysOnTop;
    appWindow.setAlwaysOnTop(next);
    onChange({ ...settings, isAlwaysOnTop: next });
  };

  return (
    <SettingsPanel title     = "Always on top" hint            = "Keeps this window above other apps.">
    <label         className = "settings-checkbox-row" htmlFor = "always-on-top">
    <input         id        = "always-on-top" type            = "checkbox" className = "settings-toggle" checked = {settings.isAlwaysOnTop} onChange = {toggle} />
        <span>Keep this window above all others</span>
      </label>
    </SettingsPanel>
  );
}

function PerformanceSection({ settings, onChange }: SettingsSectionProps) {
  return (
    <SettingsPanel
      title = "Performance"
      hint  = "Turns off the interactive background, splash particles, page motion, and background blur."
    >
      <label className = "settings-checkbox-row" htmlFor = "reduce-animations">
        <input
          id        = "reduce-animations"
          type      = "checkbox"
          className = "settings-toggle"
          checked   = {settings.reduceAnimationsEnabled}
          onChange  = {() => onChange({ ...settings, reduceAnimationsEnabled: !settings.reduceAnimationsEnabled })}
        />
        <span>Reduce animations and blur for low-performance PCs</span>
      </label>
    </SettingsPanel>
  );
}

const DEFAULT_ACCENT_COLOR = '#a111ff';

function AccentColorSection({ settings, onChange }: SettingsSectionProps) {
  const swatchRef                   = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const color                       = normalizeHex(settings.accentColor ?? DEFAULT_ACCENT_COLOR);

  return (
    <SettingsPanel title = "Accent color" hint = "Swap the app's purple accent for your own pick.">
      <div className = "settings-timing-row" data-tauri-drag-region>
        <label htmlFor = "accent-color-swatch">App accent</label>
        <div className = "seconds-stepper">
          <button
            ref           = {swatchRef}
            id            = "accent-color-swatch"
            type          = "button"
            className     = "keybind-box"
            aria-haspopup = "dialog"
            aria-expanded = {pickerOpen}
            style         = {{ backgroundColor: color, minWidth: 48 }}
            onClick       = {() => setPickerOpen((open) => !open)}
          />
          {settings.accentColor && (
            <button
              type      = "button"
              className = "app-btn app-btn-secondary app-btn-compact"
              onClick   = {() => onChange({ ...settings, accentColor: null })}
            >
              Reset
            </button>
          )}
        </div>
      </div>
      {pickerOpen && (
        <ColorWheelPicker
          color     = {color}
          onChange  = {(next) => onChange({ ...settings, accentColor: next })}
          onClose   = {() => setPickerOpen(false)}
          anchorRef = {swatchRef}
        />
      )}
    </SettingsPanel>
  );
}

function NotificationsSection({ settings, onChange }: SettingsSectionProps) {
  const [error, setError] = useState<UserFacingError | null>(null);

  const toggle = async () => {
    const next = !settings.toastOsNotificationsEnabled;
    if (next) {
      let granted = await isPermissionGranted();
      if (!granted) {
        granted = (await requestPermission()) === 'granted';
      }
      if (!granted) {
        setError(userError(
          'notifications_blocked',
          'Desktop notifications are blocked',
          'Allow notifications for this app in Windows Settings, Notifications, then try again.',
        ));
        return;
      }
    }
    setError(null);
    setOsNotifications(next);
    onChange({ ...settings, toastOsNotificationsEnabled: next });
  };

  return (
    <SettingsPanel title     = "Desktop alerts" hint           = "Show in-app notifications in the Windows notification center.">
    <label         className = "settings-checkbox-row" htmlFor = "desktop-notifications">
        <input
          id        = "desktop-notifications"
          type      = "checkbox"
          className = "settings-toggle"
          checked   = {settings.toastOsNotificationsEnabled}
          onChange  = {toggle}
        />
        <span>Show Windows notifications</span>
      </label>
      {error && <ErrorDisplay error = {error} />}
      <label className = "settings-checkbox-row" htmlFor = "mute-alert-sounds">
        <input
          id        = "mute-alert-sounds"
          type      = "checkbox"
          className = "settings-toggle"
          checked   = {settings.muteAlertSoundsEnabled}
          onChange  = {() => onChange({ ...settings, muteAlertSoundsEnabled: !settings.muteAlertSoundsEnabled })}
        />
        <span>Mute Monitor alert sounds</span>
      </label>
    </SettingsPanel>
  );
}

function ConfirmationsSection({ settings, onChange }: SettingsSectionProps) {
  return (
    <SettingsPanel title     = "Risky actions" hint            = "Ask before deletes, resets, Close All, and similar.">
    <label         className = "settings-checkbox-row" htmlFor = "confirm-before-actions">
        <input
          id        = "confirm-before-actions"
          type      = "checkbox"
          className = "settings-toggle"
          checked   = {settings.confirmBeforeActionsEnabled}
          onChange  = {() => onChange({ ...settings, confirmBeforeActionsEnabled: !settings.confirmBeforeActionsEnabled })}
        />
        <span>Confirm before risky actions</span>
      </label>
      <p className = "settings-hint">Applies to Close All, config post/delete, removing API keys, changing account passwords, and settings reset.</p>
    </SettingsPanel>
  );
}

function AppLogsSection() {
  const [open, setOpen] = useState(false);

  return (
    <SettingsPanel title     = "Developer logs" hint = "logs for troubleshooting bugs.">
    <div           className = "settings-actions-row" data-tauri-drag-region>
    <button        type      = "button" className    = "app-btn app-btn-secondary app-btn-compact" onClick = {() => setOpen(true)}>
          View developer logs
        </button>
      </div>
      <AnimatePresence>{open && <AppLogModal key="app-log-modal" onClose={() => setOpen(false)} />}</AnimatePresence>
    </SettingsPanel>
  );
}

function VanguardSection() {
  const [working, setWorking]   = useState(false);
  const [checking, setChecking] = useState(false);

  const checkTraces = async () => {
    setChecking(true);
    try {
      const traces = await checkVanguardTraces();
      if (traces.clean) {
        toast.success({
          title: 'No Vanguard traces found',
          body : 'The vgc/vgk services and the Riot Vanguard folder are all gone.',
        });
      } else {
        const found = [
          traces.vgcService    ? 'vgc service'          : null,
          traces.vgkService    ? 'vgk service'          : null,
          traces.installFolder ? 'Riot Vanguard folder' : null,
        ].filter(Boolean).join(', ');
        toast.warning({
          title: 'Vanguard traces still present',
          body : `Still on this PC: ${found}. Run Uninstall Vanguard, then restart to clear the rest.`,
        });
      }
    } catch (e) {
      toast.error(toastFromError(e, { title: "Couldn't check for Vanguard traces" }));
    } finally {
      setChecking(false);
    }
  };

  const uninstall = async () => {
    setChecking(true);
    let alreadyClean = false;
    try {
      alreadyClean = (await checkVanguardTraces()).clean;
    } catch {
    } finally {
      setChecking(false);
    }
    if (alreadyClean) {
      toast.info({ title: "Vanguard isn't installed", body: 'There are no Vanguard traces to remove on this PC.' });
      return;
    }

    const confirmed = await toast.confirm(
      {
        title: 'Fully uninstall Riot Vanguard?',
        body : "You will have to restart your PC afterward to finish removing the kernel driver.",
      },
      { confirmLabel: 'Uninstall Vanguard', icon: 'error' },
    );
    if (!confirmed) return;

    setWorking(true);
    try {
      await uninstallVanguard();
      const restart = await toast.confirm(
        {
          title: 'Vanguard uninstalled',
          body : 'Do you want to restart your PC? A restart finishes removing the kernel driver.',
        },
        { confirmLabel: 'Restart now', cancelLabel: 'Not now' },
      );
      if (restart) {
        try {
          localStorage.setItem(VANGUARD_REINSTALL_FLAG, '1');
        } catch {
        }
        await restartComputer();
      }
    } catch (e) {
      toast.error(toastFromError(e, { title: "Couldn't uninstall Vanguard" }));
    } finally {
      setWorking(false);
    }
  };

  return (
    <SettingsPanel title = "Uninstall Vanguard" hint = "Fully remove Riot's anti-cheat and its traces.">
      <div    className = "settings-actions-row" data-tauri-drag-region>
      <button type      = "button" className = "app-btn app-btn-danger app-btn-compact" disabled = {working || checking} onClick = {() => void uninstall()}>
          {working ? 'Uninstalling...' : 'Uninstall Vanguard'}
        </button>
      </div>
      <div    className = "settings-actions-row" data-tauri-drag-region>
      <button type      = "button" className = "app-btn app-btn-info app-btn-compact" disabled = {working || checking} onClick = {() => void checkTraces()}>
          {checking ? 'Checking...' : 'Check for traces'}
        </button>
      </div>
    </SettingsPanel>
  );
}

const MODIFIER_CODES = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);

const KEY_LABELS: Record<string, string> = {
  Backquote   : '`',
  Minus       : '-',
  Equal       : '=',
  BracketLeft : '[',
  BracketRight: ']',
  Backslash   : '\\',
  Semicolon: ';',
  Quote    : "'",
  Comma    : ',',
  Period   : '.',
  Slash    : '/',
};

function keyLabel(code: string): string {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

function LoaderPromptSection({ settings, onChange }: SettingsSectionProps) {
  return (
    <SettingsPanel
      title = "Loader"
      hint  = "Skip the prompt asking to run the loader during Start Process."
    >
      <label className = "settings-checkbox-row" htmlFor = "auto-run-loader">
        <input
          id        = "auto-run-loader"
          type      = "checkbox"
          className = "settings-toggle"
          checked   = {settings.autoRunLoaderEnabled}
          onChange  = {() => onChange({ ...settings, autoRunLoaderEnabled: !settings.autoRunLoaderEnabled })}
        />
        <span>Always run the loader without asking</span>
      </label>
    </SettingsPanel>
  );
}

function LoaderAutoRunSection({ settings, onChange }: SettingsSectionProps) {
  return (
    <SettingsPanel
      title = "Auto-run on VALORANT start"
      hint  = "Runs the loader whenever VALORANT starts, even if you launched it yourself."
    >
      <label className = "settings-checkbox-row" htmlFor = "auto-run-loader-valorant">
        <input
          id        = "auto-run-loader-valorant"
          type      = "checkbox"
          className = "settings-toggle"
          checked   = {settings.autoRunLoaderOnValorant}
          onChange  = {() => onChange({ ...settings, autoRunLoaderOnValorant: !settings.autoRunLoaderOnValorant })}
        />
        <span>Always run the loader once VALORANT is running, however it was launched</span>
      </label>
    </SettingsPanel>
  );
}

function TraceXVersionSection({ settings, onChange }: SettingsSectionProps) {
  return (
    <SettingsPanel
      title = "TraceX version"
      hint  = "Choose which version of TraceX to use. The beta TUI build (tracex.tui.exe) goes in the same folder as tracex.exe."
    >
      <div className = "tools-subsection-pill-bar tracex-version-toggle" role = "group" aria-label = "TraceX version">
        <button
          type         = "button"
          className    = {`tools-subsection-pill${!settings.tracexUseTui ? ' active' : ''}`}
          onClick      = {() => onChange({ ...settings, tracexUseTui: false })}
          aria-pressed = {!settings.tracexUseTui}
        >
          Terminal
        </button>
        <button
          type         = "button"
          className    = {`tools-subsection-pill${settings.tracexUseTui ? ' active' : ''}`}
          onClick      = {() => onChange({ ...settings, tracexUseTui: true })}
          aria-pressed = {settings.tracexUseTui}
        >
          Beta TUI
        </button>
      </div>
    </SettingsPanel>
  );
}

function InsertKeybindSection({ settings, onChange }: SettingsSectionProps) {
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

  return (
    <SettingsPanel
      title = "Insert key simulator"
      hint  = "This key will simulate pressing Insert to open the in-game menu."
    >
    <label         className = "settings-checkbox-row" htmlFor = "insert-sim-enabled">
        <input
          id        = "insert-sim-enabled"
          type      = "checkbox"
          className = "settings-toggle"
          checked   = {settings.insertSimEnabled}
          onChange  = {() => onChange({ ...settings, insertSimEnabled: !settings.insertSimEnabled })}
        />
        <span>Enable keybind</span>
      </label>

      <div    className = "settings-path-row" data-tauri-drag-region>
      <span   className = "settings-path-label">Keybind</span>
      <div    className = "settings-actions-row" data-tauri-drag-region>
      <button type      = "button" className = {`keybind-box${recording ? ' listening' : ''}`} onClick = {() => setRecording(true)}>
            {recording ? '...' : settings.insertSimKeybind ? keyLabel(settings.insertSimKeybind) : 'Set key'}
          </button>
          {settings.insertSimKeybind && (
            <button type = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => onChange({ ...settings, insertSimKeybind: null })}>
              Clear
            </button>
          )}
        </div>
      </div>
      <p className = "settings-hint">
        System-wide: while enabled, your chosen key is captured globally and sends Insert instead of its normal input.
        Pick a key you do not use often.
      </p>
    </SettingsPanel>
  );
}

type PathKey = 'emuPath' | 'loaderPath' | 'tracexPath' | 'tracexTuiPath';

interface PathRow {
  key     : PathKey;
  label   : string;
  filename: string;
}

const PATH_ROWS: PathRow[] = [
  { key: 'tracexPath', label: 'Tracex loader', filename: 'tracex.exe' },
  { key: 'tracexTuiPath', label: 'Tracex TUI (beta)', filename: 'tracex.tui.exe' },
  { key: 'emuPath', label: 'Emu installer', filename: 'emu_installer.exe' },
  { key: 'loaderPath', label: 'Loader', filename: 'ldr.exe' },
];

function FileLocationsSection({ settings, onChange }: SettingsSectionProps) {
  const browseFor = async (key: PathKey, filename: string) => {
    const knownPath   = settings[key] ?? (await findFilePath(filename));
    const defaultPath = knownPath?.replace(/[\\/][^\\/]*$/, '');
    const picked      = await open({
      multiple: false,
      filters : [{ name: 'Executable', extensions: ['exe'] }],
      title   : `Locate ${filename}`,
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
    <SettingsPanel title = "Executable paths" hint = "Leave blank to auto-detect each program.">
      {PATH_ROWS.map(({ key, label, filename }) => (
        <div  key       = {key} className = "settings-path-row" data-tauri-drag-region>
        <div  className = "settings-path-text" data-tauri-drag-region>
        <span className = "settings-path-label">{label}</span>
        <span className = "settings-path-value">{settings[key] ?? `Auto-detect (${filename})`}</span>
          </div>
          <div    className = "settings-actions-row" data-tauri-drag-region>
          <button type      = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => browseFor(key, filename)}>
              Browse
            </button>
            {settings[key] && (
              <button type = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => clearPath(key)}>
                Clear
              </button>
            )}
          </div>
        </div>
      ))}
    </SettingsPanel>
  );
}

function ManualOptionsSection({ settings, onChange }: SettingsSectionProps) {
  const toggleAction = (action: ManualAction) => {
    const enabled = settings.manualActionsEnabled.includes(action)
      ? settings.manualActionsEnabled.filter((a) => a !== action)
      :  [...settings.manualActionsEnabled, action];
    onChange({ ...settings, manualActionsEnabled: enabled });
  };

  return (
    <SettingsPanel hint      = "Toggle each action on or off.">
    <div           className = "settings-checkbox-grid" data-tauri-drag-region>
        {MANUAL_ACTIONS.map(({ action, label, hint }) => (
          <Tooltip key       = {action} content                = {hint} block>
          <label   className = "settings-checkbox-row" htmlFor = {`manual-action-${action}`}>
              <input
                id        = {`manual-action-${action}`}
                type      = "checkbox"
                className = "settings-checkbox"
                checked   = {settings.manualActionsEnabled.includes(action)}
                onChange  = {() => toggleAction(action)}
              />
              <span>{label}</span>
            </label>
          </Tooltip>
        ))}
      </div>
    </SettingsPanel>
  );
}

const SWAP_COMPACT_THRESHOLD        = 8;
const SWAP_DRAG_SELECT_THRESHOLD_PX = 4;
const SWAP_DRAG_SCROLL_EDGE_PX      = 44;
const SWAP_DRAG_SCROLL_SPEED_PX     = 14;

interface SwapDragSelectState {
  active     : boolean;
  dragging   : boolean;
  anchorIndex: number;
  mode       : 'select' | 'deselect';
  pointerId  : number;
  startX     : number;
  startY     : number;
}

function AccountSwapSection({ settings, onChange }: SettingsSectionProps) {
  const [accounts, setAccounts]               = useState<Account[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [search, setSearch]                   = useState('');
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const settingsRef                           = useRef(settings);
  const listRef                               = useRef<HTMLDivElement>(null);
  const dragSelectRef                         = useRef<SwapDragSelectState | null>(null);
  const dragPointerYRef                       = useRef(0);
  const dragScrollRafRef                      = useRef<number | null>(null);
  const filteredAccountsRef                   = useRef<Account[]>([]);

  settingsRef.current = settings;

  useEffect(() => {
    setLoading(true);
    listAccounts()
      .then(setAccounts)
      .catch((e) => {
        logSilentFailure('settings.accounts', e);
        setAccounts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const pool = settings.accountSwapPool;

  const setPool = useCallback(
    (nextPool: string[]) => {
      onChange({ ...settingsRef.current, accountSwapPool: nextPool });
    },
    [onChange],
  );

  const togglePoolAccount = useCallback(
    (id: string) => {
      const current = settingsRef.current.accountSwapPool;
      setPool(current.includes(id) ? current.filter((accountId) => accountId !== id) : [...current, id]);
    },
    [setPool],
  );

  const description   = 
        pool.length === 0
      ? 'Choose which saved accounts Account Swap should sign in to, one after another.'
      : pool.length === 1
        ? 'Account Swap always signs in to this one account.'
        :  `Account Swap rotates through these ${pool.length} accounts, picking a different one each run.`;

  const query            = search.trim().toLowerCase();
  const filteredAccounts = query
    ? accounts.filter((account) => account.label.toLowerCase().includes(query) || account.username.toLowerCase().includes(query))
    :  accounts;

  const compact           = accounts.length >= SWAP_COMPACT_THRESHOLD;
  const allFilteredInPool = filteredAccounts.length > 0 && filteredAccounts.every((account) => pool.includes(account.id));

  filteredAccountsRef.current = filteredAccounts;

  const endDragSelect = useCallback(() => {
    dragSelectRef.current = null;
    setIsDragSelecting(false);
    if (dragScrollRafRef.current !== null) {
      cancelAnimationFrame(dragScrollRafRef.current);
      dragScrollRafRef.current = null;
    }
  }, []);

  useEffect(() => () => endDragSelect(), [endDragSelect]);

  const applyDragRange = useCallback(
    (anchorIndex: number, currentIndex: number, mode: 'select' | 'deselect') => {
      const visible = filteredAccountsRef.current;
      if (visible.length === 0) return;

      const start    = Math.min(anchorIndex, currentIndex);
      const end      = Math.max(anchorIndex, currentIndex);
      const rangeIds = visible.slice(start, end + 1).map((account) => account.id);
      const current  = settingsRef.current.accountSwapPool;

      if (mode === 'select') {
        setPool([...new Set([...current, ...rangeIds])]);
      } else {
        setPool(current.filter((id) => !rangeIds.includes(id)));
      }
    },
    [setPool],
  );

  const rowIndexAtPointer = useCallback((clientY: number) => {
    const list = listRef.current;
    if (!list) return null;

    const rows = list.querySelectorAll<HTMLElement>('[data-account-select-index]');
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        const index = Number(row.dataset.accountSelectIndex);
        return Number.isFinite(index) ? index: null;
      }
    }

    return null;
  }, []);

  const stopDragScrollLoop = useCallback(() => {
    if (dragScrollRafRef.current !== null) {
      cancelAnimationFrame(dragScrollRafRef.current);
      dragScrollRafRef.current = null;
    }
  }, []);

  const autoScrollList = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const rect = list.getBoundingClientRect();
    const y    = dragPointerYRef.current;

    if (y < rect.top + SWAP_DRAG_SCROLL_EDGE_PX) {
      list.scrollTop -= SWAP_DRAG_SCROLL_SPEED_PX;
    } else if (y > rect.bottom - SWAP_DRAG_SCROLL_EDGE_PX) {
      list.scrollTop += SWAP_DRAG_SCROLL_SPEED_PX;
    }
  }, []);

  const startDragScrollLoop = useCallback(() => {
    stopDragScrollLoop();
    const tick = () => {
      const drag = dragSelectRef.current;
      if (!drag?.active || !drag.dragging) {
        dragScrollRafRef.current = null;
        return;
      }
      autoScrollList();
      const index = rowIndexAtPointer(dragPointerYRef.current);
      if (index !== null) {
        applyDragRange(drag.anchorIndex, index, drag.mode);
      }
      dragScrollRafRef.current = requestAnimationFrame(tick);
    };
    dragScrollRafRef.current = requestAnimationFrame(tick);
  }, [applyDragRange, autoScrollList, rowIndexAtPointer, stopDragScrollLoop]);

  const handleSelectPointerDown = (event: ReactPointerEvent<HTMLElement>, index: number, inPool: boolean) => {
    dragSelectRef.current = {
      active     : true,
      dragging   : false,
      anchorIndex: index,
      mode       : inPool ? 'deselect': 'select',
      pointerId  : event.pointerId,
      startX     : event.clientX,
      startY     : event.clientY,
    };
    dragPointerYRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSelectPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragSelectRef.current;
    if (!drag?.active || event.pointerId !== drag.pointerId) return;

    dragPointerYRef.current = event.clientY;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.dragging && (Math.abs(dx) > SWAP_DRAG_SELECT_THRESHOLD_PX || Math.abs(dy) > SWAP_DRAG_SELECT_THRESHOLD_PX)) {
      drag.dragging = true;
      setIsDragSelecting(true);
      startDragScrollLoop();
    }

    if (!drag.dragging) return;

    const hoverIndex = rowIndexAtPointer(event.clientY);
    if (hoverIndex !== null) {
      applyDragRange(drag.anchorIndex, hoverIndex, drag.mode);
    }
  };

  const handleSelectPointerEnter = (event: ReactPointerEvent<HTMLElement>, index: number) => {
    const drag = dragSelectRef.current;
    if (!drag?.active || !drag.dragging || event.pointerId !== drag.pointerId) return;
    applyDragRange(drag.anchorIndex, index, drag.mode);
  };

  const handleSelectPointerUp = (event: ReactPointerEvent<HTMLElement>, accountId: string) => {
    const drag = dragSelectRef.current;
    if (!drag?.active || event.pointerId !== drag.pointerId) return;

    const wasDragging = drag.dragging;
    endDragSelect();

    if (!wasDragging) {
      togglePoolAccount(accountId);
    }
  };

  const selectAllFiltered = () => {
    setPool([...new Set([...pool, ...filteredAccounts.map((account) => account.id)])]);
  };

  const clearPool = () => setPool([]);

  return (
    <SettingsPanel className = "account-swap-section" hint = {description}>
      {loading && (
        <div className = {`account-list account-swap-list${compact ? ' account-list--compact' : ''}`} data-tauri-drag-region>
          {Array.from({ length: compact ? 4 : 3 }).map((_, i) => (
            <div      key       = {i} className              = "surface-card account-row account-row--selectable" data-tauri-drag-region>
            <Skeleton width     = {compact ? 32 : 40} height = {compact ? 32 : 40} className = "rounded-full" />
            <div      className = "account-row-body" data-tauri-drag-region>
            <Skeleton width     = {120} height               = {compact ? 12 : 14} />
            <Skeleton width     = {80} height                = {11} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && accounts.length === 0 && (
        <div className = "accounts-empty account-swap-empty" data-tauri-drag-region>
        <div className = "accounts-empty-icon" aria-hidden = "true">
            <SwapUserIcon />
          </div>
          <p className = "accounts-empty-title">No accounts saved yet</p>
          <p className = "accounts-empty-hint">Add accounts on the Accounts page, then choose which ones Account Swap should rotate through.</p>
        </div>
      )}

      {!loading && accounts.length > 0 && (
        <>
          <div className = "accounts-toolbar account-swap-toolbar" data-tauri-drag-region>
            <input
              type        = "text"
              className   = "accounts-search"
              placeholder = "Search accounts..."
              value       = {search}
              onChange    = {(e) => setSearch(e.target.value)}
            />
            <span className = "accounts-toolbar-count">
              {pool.length} in rotation
              {filteredAccounts.length !== accounts.length ? ` | ${filteredAccounts.length} shown` : ` | ${accounts.length} total`}
            </span>
          </div>

          <div  className = "accounts-bulk-bar account-swap-bulk-bar" data-tauri-drag-region>
          <span className = "accounts-bulk-summary">
              {pool.length === 0 ? 'Tap rows to select accounts, or click and drag down the list' : `${pool.length} account${pool.length === 1 ? '' : 's'} in rotation`}
            </span>
            <div className = "accounts-bulk-actions">
              <button
                type      = "button"
                className = "app-btn app-btn-secondary app-btn-compact"
                disabled  = {filteredAccounts.length === 0 || allFilteredInPool}
                onClick   = {selectAllFiltered}
              >
                {allFilteredInPool ? 'All shown selected' : 'Select all shown'}
              </button>
              {pool.length > 0 && (
                <button type = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {clearPool}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {filteredAccounts.length === 0 ? (
            <p className = "accounts-notice">No accounts match "{search}".</p>
          ) : (
            <div
              ref       = {listRef}
              className = {`account-list account-swap-list${compact ? ' account-list--compact' : ''}${isDragSelecting ? ' account-list--drag-selecting' : ''}`}
              role      = "listbox"
              aria-multiselectable
              data-tauri-drag-region
            >
              {filteredAccounts.map((account, index) => (
                <SwapPoolAccountRow
                  key                  = {account.id}
                  account              = {account}
                  index                = {index}
                  compact              = {compact}
                  inPool               = {pool.includes(account.id)}
                  hideUsernames        = {settings.hideAccountUsernames}
                  onSelectPointerDown  = {(event) => handleSelectPointerDown(event, index, pool.includes(account.id))}
                  onSelectPointerMove  = {handleSelectPointerMove}
                  onSelectPointerEnter = {(event) => handleSelectPointerEnter(event, index)}
                  onSelectPointerUp    = {(event) => handleSelectPointerUp(event, account.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </SettingsPanel>
  );
}

function SwapPoolAccountRow({
  account,
  index,
  compact,
  inPool,
  hideUsernames,
  onSelectPointerDown,
  onSelectPointerMove,
  onSelectPointerEnter,
  onSelectPointerUp,
}: {
  account             : Account;
  index               : number;
  compact             : boolean;
  inPool              : boolean;
  hideUsernames       : boolean;
  onSelectPointerDown : (event: ReactPointerEvent<HTMLElement>) => void;
  onSelectPointerMove : (event: ReactPointerEvent<HTMLElement>) => void;
  onSelectPointerEnter: (event: ReactPointerEvent<HTMLElement>) => void;
  onSelectPointerUp   : (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const sessionBadge = account.hasSession ? (
    <Tooltip content   = "Sign in uses a saved Riot session">
    <span    className = "app-badge app-badge-success">{compact ? 'Saved session' : 'Session saved'}</span>
    </Tooltip>
  ) : (
    <Tooltip content   = "Next login signs in fresh through the Riot Client">
    <span    className = "app-badge app-badge-muted">{compact ? 'No saved session' : 'Fresh login'}</span>
    </Tooltip>
  );

  return (
    <div
      className = {`surface-card account-row account-row--selectable${compact ? ' account-row--compact' : ''}${inPool ? ' account-row--selected' : ''}`}
      data-tauri-drag-region
    >
      <div
        className                 = "account-row-select-label"
        data-account-select-index = {index}
        role                      = "option"
        aria-selected             = {inPool}
        onPointerDown             = {onSelectPointerDown}
        onPointerMove             = {onSelectPointerMove}
        onPointerEnter            = {onSelectPointerEnter}
        onPointerUp               = {onSelectPointerUp}
        onPointerCancel           = {onSelectPointerUp}
      >
        <input
          type      = "checkbox"
          className = "settings-checkbox account-row-checkbox"
          checked   = {inPool}
          readOnly
          tabIndex    = {-1}
          aria-hidden = "true"
        />
        <div className = "account-row-avatar" aria-hidden = "true">
          {accountAvatarInitial(account.label)}
        </div>
        <div  className = "account-row-body">
        <div  className = "account-row-top">
        <span className = "account-row-label">{account.label}</span>
            {sessionBadge}
          </div>
          <span className = {`account-row-username${hideUsernames ? ' account-row-username--masked' : ''}`} aria-label = {hideUsernames ? 'Username hidden' : undefined}>
            {displayUsername(account.username, hideUsernames)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SwapUserIcon() {
  return (
    <svg    viewBox = "0 0 24 24" fill                         = "none" aria-hidden         = "true">
    <circle cx      = "12" cy                                  = "8" r                      = "3.2" stroke        = "currentColor" strokeWidth = "1.6" />
    <path   d       = "M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke = "currentColor" strokeWidth = "1.6" strokeLinecap = "round" />
    </svg>
  );
}

function HenrikApiKeySection({ settings, onChange }: SettingsSectionProps) {
  const keys = settings.henrikApiKeys.length > 0 ? settings.henrikApiKeys : [''];

  const updateKey = (index: number, value: string) => {
    const next   = [...keys];
    next [index] = value;
    onChange({ ...settings, henrikApiKeys: next });
  };

  const removeKey = async (index: number) => {
    const notice = { title: 'Remove this API key?', body: "You'll need to add it again to use it later.", icon: 'error' as const };
    if (!(await confirmIfEnabled(notice, 'Remove'))) return;
    onChange({ ...settings, henrikApiKeys: keys.filter((_, i) => i !== index) });
  };

  const addKey = () => {
    onChange({ ...settings, henrikApiKeys: [...keys, ''] });
  };

  return (
    <SettingsPanel
      title = "API keys"
      hint  = "Required for the Lookup and Monitor tools. More keys means fewer rate-limit waits."
    >
      <div className = "settings-key-list" data-tauri-drag-region>
        {keys.map((key, index) => (
          <div  key       = {index} className = "settings-key-row" data-tauri-drag-region>
          <span className = "settings-key-number">{index + 1}</span>
            <input
              type        = "text"
              className   = "tools-input settings-key-input"
              placeholder = "HDEV-..."
              value       = {key}
              onChange    = {(e) => updateKey(index, e.target.value)}
            />
            <Tooltip content = "Remove this key">
              <button
                type       = "button"
                className  = "settings-key-remove"
                onClick    = {() => removeKey(index)}
                disabled   = {keys.length === 1 && !key}
                aria-label = "Remove this key"
              >
                ×
              </button>
            </Tooltip>
          </div>
        ))}
      </div>

      <div    className = "settings-actions-row" data-tauri-drag-region>
      <button type      = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {addKey}>
          + Add another key
        </button>
        <button type = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => openUrl(HENRIK_DASHBOARD_URL)}>
          Get a free key
        </button>
      </div>
    </SettingsPanel>
  );
}

function GuidesSection() {
  return (
    <SettingsPanel
      title = "Setup guides"
      hint  = "Enter your license key to access the setup instructions, video guide, and fixes for common issues."
    >
      <div    className = "settings-actions-row" data-tauri-drag-region>
      <button type      = "button" className = "app-btn app-btn-primary app-btn-compact" onClick = {() => openUrl(GUIDES_URL)}>
          Open guides
        </button>
      </div>
    </SettingsPanel>
  );
}

function OpenSourceSection() {
  return (
    <SettingsPanel
      title = "Open source"
      hint  = "Free and open source under GPL-3.0. Built for the Sys-Info community. Report bugs on GitHub or Discord."
    >
      <div    className = "settings-actions-row" data-tauri-drag-region>
      <button type      = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => openUrl(GITHUB_URL)}>
          View source on GitHub
        </button>
      </div>
    </SettingsPanel>
  );
}

const FEEDBACK_KINDS: { kind: FeedbackKind; label: string }[] = [
  { kind: 'feature', label: 'Feature' },
  { kind: 'bug', label: 'Bug' },
];

const FEEDBACK_COPY: Record<FeedbackKind, { hint: string; titlePlaceholder: string; descriptionPlaceholder: string; button: string; sentTitle: string; sentBody: string }> = {
  feature: {
    hint                  : 'Got an idea for this app? Send it here.',
    titlePlaceholder      : 'Feature name',
    descriptionPlaceholder: 'What should it do?',
    button                : 'Send suggestion',
    sentTitle             : 'Suggestion sent',
    sentBody              : 'Thanks! Your feedback was sent to the dev.',
  },
  bug: {
    hint                  : "Found a bug? Send it here.",
    titlePlaceholder      : "What's broken?",
    descriptionPlaceholder: 'What happened, and what did you expect instead?',
    button                : 'Send report',
    sentTitle             : 'Bug report sent',
    sentBody              : 'Thanks! the dev has been notified about this.',
  },
};

function FeedbackSection() {
  const [kind, setKind]               = useState<FeedbackKind>('feature');
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending]         = useState(false);
  const copy                          = FEEDBACK_COPY[kind];

  const switchKind = (next: FeedbackKind) => {
    setKind(next);
    setTitle('');
    setDescription('');
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSending(true);
    try {
      await submitFeedback(kind, title.trim(), description.trim());
      toast.success({ title: copy.sentTitle, body: copy.sentBody });
      setTitle('');
      setDescription('');
    } catch (e) {
      toast.error(toastFromError(e, { title: "Couldn't send this" }));
    } finally {
      setSending(false);
    }
  };

  return (
    <SettingsPanel
      title         = "Feedback"
      hint          = {copy.hint}
      headerActions = {
        <div className = "app-tab-bar app-tab-bar--inline app-tab-bar--compact app-tab-bar--cols-2 drag-surface" role = "tablist" data-tauri-drag-region>
          {FEEDBACK_KINDS.map(({ kind: id, label }) => (
            <button
              key           = {id}
              type          = "button"
              role          = "tab"
              aria-selected = {id === kind}
              className     = {`app-tab-button${id === kind ? ' active' : ''}`}
              onClick       = {() => switchKind(id)}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <input
        type        = "text"
        className   = "tools-input"
        placeholder = {copy.titlePlaceholder}
        maxLength   = {100}
        value       = {title}
        onChange    = {(e) => setTitle(e.target.value)}
      />
      <textarea
        className   = "tools-input settings-suggestion-textarea"
        placeholder = {copy.descriptionPlaceholder}
        maxLength   = {1000}
        value       = {description}
        onChange    = {(e) => setDescription(e.target.value)}
      />

      <div className = "settings-actions-row" data-tauri-drag-region>
        <button
          type      = "button"
          className = "app-btn app-btn-primary app-btn-compact"
          onClick   = {submit}
          disabled  = {sending || !title.trim() || !description.trim()}
        >
          {sending ? 'Sending...' : copy.button}
        </button>
      </div>
    </SettingsPanel>
  );
}

function CreditsSection({ onOpenScene }: { onOpenScene?: () => void }) {
  const [credit, setCredit] = useState<AppCredit | null>(null);
  const [error, setError]   = useState<UserFacingError | null>(null);

  useEffect(() => {
    getAppCredit()
      .then(setCredit)
      .catch((e) => setError(parseInvokeError(e)));
  }, []);

  return (
    <SettingsPanel title = "Credits">
      {error && <ErrorDisplay error = {error} />}

      {!credit && !error && (
        <div      className = "skeleton-section" data-tauri-drag-region>
        <Skeleton height    = {56} />
        </div>
      )}

      {credit && <DiscordCard credit={credit} />}

      {onOpenScene ? (
        <button type = "button" className = "app-btn app-btn-secondary app-btn-compact scene-open-button" onClick = {onOpenScene}>
          Open 3D scene
        </button>
      ) : null}
    </SettingsPanel>
  );
}

function DiscordCard({ credit }: { credit: AppCredit }) {
  const [copied, setCopied] = useState(false);

  const copyUsername = async () => {
    await navigator.clipboard.writeText(credit.username);
    setCopied(true);
    setTimeout(() => setCopied(false), CLIPBOARD_ACK_MS);
  };

  return (
    <div className = "discord-card" data-tauri-drag-region>
    <div className = "discord-card-avatar-wrap">
    <img src       = {credit.avatarDataUrl} alt = "" className = "discord-card-avatar" />
        {credit.decorationDataUrl && <img src={credit.decorationDataUrl} alt="" className="discord-card-decoration" />}
        <Tooltip content   = {STATUS_LABELS[credit.status] ?? credit.status}>
        <span    className = {`discord-card-status discord-status-${credit.status}`} />
        </Tooltip>
      </div>
      <div className          = "discord-card-info" data-tauri-drag-region>
      <div className          = "discord-card-name">
      made by <span className = "discord-card-display-name">{credit.displayName}</span>
        </div>
        <Tooltip content = {copied ? 'Copied!' : 'Copy username'}>
        <button  type    = "button" className = "discord-card-username" onClick = {copyUsername}>
            {copied ? 'Copied!' : `@${credit.username}`}
          </button>
        </Tooltip>
        {credit.activityText && <div className="discord-card-activity">{credit.activityText}</div>}
      </div>
    </div>
  );
}

function ChangelogSection() {
  const [open, setOpen]         = useState(false);
  const [content, setContent]   = useState<string | null>(null);
  const [error, setError]       = useState<UserFacingError | null>(null);
  const [expanded, setExpanded] = useState<number | null>(0);

  const show = () => {
    setOpen(true);
    if (content || error) return;
    fetchChangelog()
      .then(setContent)
      .catch((e) => setError(parseInvokeError(e)));
  };

  if (!open) {
    return (
      <SettingsPanel title     = "What's new" hint  = "See what's changed in recent updates.">
      <div           className = "settings-actions-row" data-tauri-drag-region>
      <button        type      = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {show}>
            What's new
          </button>
        </div>
      </SettingsPanel>
    );
  }

  const entries = content ? parseChangelog(content) : [];

  return (
    <SettingsPanel
      className     = "changelog-section"
      title         = "What's new"
      headerActions = {
        <button type = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => setOpen(false)}>
          Close
        </button>
      }
    >
      {error && <ErrorDisplay error = {error} onRetry = {show} />}

      {!content && !error && (
        <div      className = "skeleton-section" data-tauri-drag-region>
        <Skeleton height    = {13} />
        <Skeleton height    = {13} width = "80%" />
        <Skeleton height    = {13} width = "60%" />
        </div>
      )}

      {content && (
        <div className = "changelog-entries" data-tauri-drag-region>
          {entries.map((entry, i) => {
            const isExpanded = expanded === i;
            return (
              <article key = {i} className = "changelog-entry" data-tauri-drag-region>
                <button
                  type          = "button"
                  className     = "changelog-entry-toggle"
                  onClick       = {() => setExpanded(isExpanded ? null : i)}
                  aria-expanded = {isExpanded}
                >
                  <span className = "changelog-entry-toggle-text">
                    {entry.title && <span className="changelog-version">{entry.title}</span>}
                    {entry.date && <span className="changelog-date">{entry.date}</span>}
                  </span>
                  <ChevronIcon expanded = {isExpanded} />
                </button>
                {isExpanded && <div className="changelog-entry-body">{entry.body}</div>}
              </article>
            );
          })}
        </div>
      )}
    </SettingsPanel>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className   = "changelog-entry-chevron"
      viewBox     = "0 0 24 24"
      fill        = "none"
      aria-hidden = "true"
      style       = {{ transform: expanded ? 'rotate(180deg)' : 'none' }}
    >
      <path d = "M6 9l6 6 6-6" stroke = "currentColor" strokeWidth = "2" strokeLinecap = "round" strokeLinejoin = "round" />
    </svg>
  );
}

interface ChangelogEntry {
  title: string | null;
  date : string | null;
  body : React.ReactNode[];
}

function parseChangelog(text: string): ChangelogEntry[] {
  const lines              = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[][] = [];

  for (const line of lines) {
    if (/^#\s+/.test(line.trimEnd()) || blocks.length === 0) {
      blocks.push([]);
    }
    blocks[blocks.length - 1].push(line);
  }

  return blocks.map((block) => {
    const titleMatch = block[0]?.trimEnd().match(/^#\s+(.*)$/);
    const title      = titleMatch ? titleMatch[1] : null;
    const rest       = titleMatch ? block.slice(1) : block;

    let   date: string | null = null;
    let   bodyLines           = rest;
    const firstContentIndex   = rest.findIndex((l) => l.trim() !== '');
    if (firstContentIndex !== -1) {
      const candidate = rest[firstContentIndex].trim();
      if (!/^#{1,2}\s+/.test(candidate) && !/^[-*]\s+/.test(candidate)) {
        date      = candidate;
        bodyLines = rest.slice(firstContentIndex + 1);
      }
    }

    return { title, date, body: renderBody(bodyLines) };
  });
}

function renderBody(lines: string[]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let   listItems: string[]      = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key = {`list-${nodes.length}`} className = "changelog-list">
        {listItems.map((item, i) => (
          <li key = {i}>{renderListItem(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const line   = rawLine.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const h2     = line.match(/^##\s+(.*)$/);

    if (bullet) {
      listItems.push(bullet[1]);
      continue;
    }
    flushList();

    if (h2) {
      nodes.push(
        <h4 key = {nodes.length} className = "changelog-heading">
          {renderInline(h2[1])}
        </h4>,
      );
    } else if (line.trim() === '') {
      continue;
    } else {
      nodes.push(
        <p key = {nodes.length} className = "changelog-paragraph">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushList();

  return nodes;
}

function renderListItem(text: string): React.ReactNode {
  const match = text.match(/^([^:]{1,48}):\s(.*)$/);
  if (!match) return renderInline(text);
  return (
    <>
      <strong>{match[1]}: </strong> {renderInline(match[2])}
    </>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>));
}
