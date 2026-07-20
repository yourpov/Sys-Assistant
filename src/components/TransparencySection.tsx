import { openUrl } from '@tauri-apps/plugin-opener';
import { useState, type ReactNode } from 'react';

import { AnimatedLink } from '@/components/ui/animated-link';

import { CLIPBOARD_ACK_MS } from '../constants/timing';
import { GITHUB_URL, HENRIK_DASHBOARD_URL } from '../constants/urls';
import { toast } from '../hooks/useToastStore';
import { Tooltip } from './Tooltip';

const SUPABASE_URL     = 'https://ykzpldiiygssqtcmvlvn.supabase.co';
const HENRIK_API_URL   = 'https://api.henrikdev.xyz';
const VALORANT_API_URL = 'https://valorant-api.com';
const VC_REDIST_URL    = 'https://aka.ms/vc14/vc_redist.x64.exe';
const LANYARD_API_URL  = 'https://api.lanyard.rest';
const DISCORD_CDN_URL  = 'https://cdn.discordapp.com';
const DISCORD_URL      = 'https://sys-info.xyz/discord';
const TRACKER_URL      = 'https://tracker.gg';
const VTL_URL          = 'https://vtl.lol';

type CopyTarget = {
  label: string;
  value: string;
};

type CopyableEntry = {
  title      : string;
  description: ReactNode;
  copies     : CopyTarget[];
};

function NavLink({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  if (!onClick) return <>{children}</>;
  return (
    <AnimatedLink variant="left" showArrow={false} className="transparency-inline-link" onClick={onClick}>
      {children}
    </AnimatedLink>
  );
}

type TransparencyBlock = {
  title    : string;
  hint    ?: string;
  items   ?: ReactNode[];
  copyable?: CopyableEntry[];
};

function TransLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <AnimatedLink
      variant="left"
      showArrow={false}
      className="transparency-inline-link"
      onClick={() => void openUrl(href)}
    >
      {children}
    </AnimatedLink>
  );
}

const SENT_OVER_INTERNET_ITEMS: ReactNode[] = [
  <>
    Supabase (<TransLink href={SUPABASE_URL}>ykzpldiiygssqtcmvlvn.supabase.co</TransLink>): Discord sign-in, guest sign-in, community
    configs board posts, reactions, and comments when signed in. Feature and bug feedback sends title and description only (no Discord name from
    the app).
  </>,
  <>
    HenrikDev API (<TransLink href={HENRIK_API_URL}>api.henrikdev.xyz</TransLink>): Riot name/tag, region, PUUID, and your API keys when you
    use Lookup or Monitor in Tools.
  </>,
  <>
    Riot local API (127.0.0.1): lockfile password for entitlements. Used to launch Valorant, read your live match roster, and load owned
    cosmetics in Collection.
  </>,
  <>Riot GLZ API (glz-*.a.pvp.net): access token, entitlements JWT, client version headers, and lobby player PUUIDs.</>,
  <>
    <TransLink href = {VALORANT_API_URL}>valorant-api.com</TransLink>: public map, agent, season, version, and cosmetic name/icon metadata
    (cached locally for Collection). No account data.
  </>,
  <>
    <TransLink href = {GITHUB_URL}>GitHub</TransLink>: changelog text and update manifest when you check for updates or open What&apos;s new.
  </>,
  <>
    Microsoft (<TransLink href={VC_REDIST_URL}>aka.ms</TransLink>): VC++ redistributable download if missing during Check for issues.
  </>,
  <>
    Lanyard (<TransLink href={LANYARD_API_URL}>api.lanyard.rest</TransLink>): public Discord presence for the splash screen credit line.
  </>,
  <>
    Discord CDN (<TransLink href={DISCORD_CDN_URL}>cdn.discordapp.com</TransLink>): avatar images for community configs, comments, and
    credits.
  </>,
  <>
    Links opened in your browser (not sent by the app): {' '}
    <TransLink href = {HENRIK_DASHBOARD_URL}>HenrikDev dashboard</TransLink>, <TransLink href = {GITHUB_URL}>GitHub</TransLink>,      {' '}
    <TransLink href = {DISCORD_URL}>sys-info.xyz Discord</TransLink>,         <TransLink href = {TRACKER_URL}>tracker.gg</TransLink>, {' '}
    <TransLink href = {VTL_URL}>vtl.lol</TransLink>.
  </>,
];

const CONFIG_ROOT        = '%AppData%\\gg.sysinfo.automate\\';
const CREDENTIAL_SERVICE = 'gg.sysinfo.automate';

function storedOnPcEntries(onOpenToolsMatch?: () => void): CopyableEntry[] {
  return [
  {
    title      : 'App data folder',
    description: 'Root folder for settings, accounts, sign-in session, and saved Riot session snapshots.',
    copies     : [{ label: 'Config folder', value: CONFIG_ROOT }],
  },
  {
    title      : 'settings.json',
    description: 'App preferences: file paths, toggles, Manual steps, HenrikDev API keys, Account Swap pool, and keybinds.',
    copies     : [{ label: 'File path', value: `${CONFIG_ROOT}settings.json` }],
  },
  {
    title      : 'accounts.json',
    description: 'Saved account labels and Riot usernames. Passwords are not stored in this file.',
    copies     : [{ label: 'File path', value: `${CONFIG_ROOT}accounts.json` }],
  },
  {
    title      : 'saved_players.json',
    description: (
      <>
        Players you bookmark from the{' '}
        <NavLink onClick = {onOpenToolsMatch}>Match</NavLink> tab: Riot ID, last seen rank, agent, and save date. Stays on your PC only.
      </>
    ),
    copies: [{ label: 'File path', value: `${CONFIG_ROOT}saved_players.json` }],
  },
  {
    title      : 'Windows Credential Manager',
    description: 'Riot passwords, one entry per saved account.',
    copies     : [{ label: 'Credential service name', value: CREDENTIAL_SERVICE }],
  },
  {
    title      : 'auth_session.json',
    description: 'Sign-in session file when you sign in with Discord or continue as guest. Tokens stay on your PC only.',
    copies     : [{ label: 'File path', value: `${CONFIG_ROOT}auth_session.json` }],
  },
  {
    title      : 'collection_content_cache_v4.json',
    description: 
      'Cached Valorant cosmetic names and icons from valorant-api.com for Tools > Collection. Refreshes about once per day. No account data.',
    copies: [{ label: 'File path', value: `${CONFIG_ROOT}collection_content_cache_v4.json` }],
  },
  {
    title      : 'Session snapshots',
    description: 'Copied Riot Client session files for Account Swap: lockfile, settings YAML, private settings, session data, and client config.',
    copies     : [{ label: 'Folder pattern', value: `${CONFIG_ROOT}sessions\\{account-id}\\` }],
  },
  {
    title      : 'Browser localStorage',
    description: 'Tools monitor settings and lookup history (up to 12 Riot IDs).',
    copies     : [
      { label: 'Monitor config key', value: 'tools-monitor-config' },
      { label: 'Lookup history key', value: 'tools-lookup-history' },
    ],
  },
  {
    title      : 'Browser sessionStorage',
    description: 'Temporary UI state for this app window. Cleared when the window session ends.',
    copies     : [
      { label: 'Settings group state', value: 'settings-group-state' },
      { label: 'Automate panel state', value: 'automate-expandable-state' },
      { label: 'Tools lookup draft', value: 'tools-lookup-last' },
      { label: 'Tools match info draft', value: 'tools-matchinfo-last' },
    ],
  },
  {
    title      : 'In-memory only',
    description: 'Developer logs (up to 2000 lines), toast archive, and short-lived API caches. Cleared when you restart the app.',
    copies     : [],
  },
];
}

const FILES_AND_FOLDERS: CopyableEntry[] = [
  {
    title      : 'Riot Client',
    description: 
      'lockfile, RiotClientSettings.yaml, RiotGamesPrivateSettings.yaml, and Sessions. Read for login state. Written when saving or restoring Account Swap sessions or fixing stay signed in.',
    copies: [{ label: 'Folder path', value: '%LocalAppData%\\Riot Games\\Riot Client\\' }],
  },
  {
    title      : 'Valorant log',
    description: 'read only for match and session checks.',
    copies     : [{ label: 'File path', value: '%LocalAppData%\\VALORANT\\Saved\\Logs\\ShooterGame.log' }],
  },
  {
    title      : 'Riot install lookup',
    description: 
      'auto-finds RiotClientServices.exe from RiotClientInstalls.json and common install folders. May write client config YAML during session snapshots.',
    copies: [{ label: 'File path', value: '%ProgramData%\\Riot Games\\RiotClientInstalls.json' }],
  },
  {
    title      : 'Automation files',
    description: 
      'The files are not provided with the app. These files are from the private Sys-Info community. They are meant to be placed beside the app or set paths under Settings > Automation > Files Locations. Only these two .exe files are detected and ran.',
    copies: [
      { label: 'Emu installer', value: 'emu_installer.exe' },
      { label: 'Loader', value: 'ldr.exe' },
    ],
  },
  {
    title      : 'File dialogs you control',
    description: 
      'Account .txt export and import on the Accounts page, and optional emu/loader .exe paths under Settings > Automation > Files Locations.',
    copies: [],
  },
  {
    title      : 'VC++ redistributable temp file',
    description: 'downloaded and run during the VC++ install step.',
    copies     : [{ label: 'File path', value: '%Temp%\\vc_redist.x64.exe' }],
  },
];

const WINDOWS_SYSTEM_CHANGES: CopyableEntry[] = [
  {
    title      : 'Remote Desktop registry value',
    description: 'may set to 1 to disable Remote Desktop when fixing RDP issues. A restart prompt may follow.',
    copies     : [{ label: 'Registry path', value: 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server\\fDenyTSConnections' }],
  },
  {
    title      : 'EMU_SEED registry value',
    description: 'reads and writes a random seed when you run Change seed from Manual steps.',
    copies     : [
      {
        label: 'Registry path',
        value: 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment\\EMU_SEED',
      },
    ],
  },
  {
    title      : 'Registry reads only',
    description: 'Core Isolation (HVCI), Microsoft Vulnerable Driver Blocklist, Local Security Authority protection, VC++ redistributable installed, and Windows build number.',
    copies     : [],
  },
];

function transparencyBlocks(onOpenToolsMatch?: () => void): TransparencyBlock[] {
  return [
  {
    title: 'Summary',
    hint : 'Private Assistant is by the Sys-Info community, for the Sys-Info community. Most data stays on your PC. Online features only run when you use them.',
    items: [
      'No ads and no data sales.',
      'Installer ships the app only. Automation tools are files you add on your PC.',
      'Riot passwords stay on your PC unless you export them yourself.',
      'Community configs, comments, and likes need sign-in and go to Supabase.',
      'Tools tab lookups send Riot IDs and HenrikDev API keys when you run them.',
    ],
  },
  {
    title   : 'Stored on your PC',
    hint    : 'Everything below stays on your PC. Tap a path or key to copy it.',
    copyable: storedOnPcEntries(onOpenToolsMatch),
  },
  {
    title: 'Sent over the internet',
    items: SENT_OVER_INTERNET_ITEMS,
  },
  {
    title   : 'Files and folders read or written',
    hint    : 'Tap a path to copy it.',
    copyable: FILES_AND_FOLDERS,
  },
  {
    title: 'Programs controlled or monitored',
    items: [
      'Launches, monitors, or closes: RiotClientServices, VALORANT, tracex.exe, ldr.exe, and emu_installer.exe.',
      'Windows services vgc and vgk: queried during Check for issues. vgc can be started. vgk must be off.',
      'Riot login window: UI automation fills username and password and toggles stay signed in during Account Swap.',
      'Global hotkey (optional): simulates your configured key plus Insert for in-game actions.',
      'shutdown /r /t 0: restarts your PC if you confirm after Remote Desktop is disabled.',
    ],
  },
  {
    title   : 'Windows system changes',
    hint    : 'Tap a registry path to copy it.',
    copyable: WINDOWS_SYSTEM_CHANGES,
  },
  {
    title: 'Sign-in and community identity',
    items: [
      'Discord sign-in: browser OAuth via Supabase. Session tokens stored locally in auth_session.json.',
      'Guest sign-in: anonymous Supabase account with the same session file shape and is_guest flag.',
      'The UI sees user id, Discord username, and avatar URL. Tokens stay in the Rust backend.',
      'Posting configs, comments, or reactions stores your Discord username and avatar on the community configs board.',
      'Reading the community configs board works without sign-in.',
    ],
  },
  {
    title: 'App permissions',
    items: [
      'Window controls: move, resize, minimize, close, and always on top.',
      'File dialogs: open and save for account .txt export/import and automation executable paths in Settings.',
      'Open URLs: launches your default browser for links.',
      'Notifications: optional Windows toast alerts.',
      'Updater: checks GitHub releases and can download and install updates.',
      'Deep link sysautomate://: OAuth callback after Discord sign-in.',
      'Global shortcut: optional hotkey registered system-wide when enabled.',
    ],
  },
  {
    title: 'What this app does not do',
    items: [
      'No always-on background telemetry or analytics SDK.',
      'No keystroke logging outside the optional global hotkey you configure.',
      'No uploading Riot passwords, lockfile contents, or full session files to remote servers.',
      'No editing Valorant gameplay files beyond reading ShooterGame.log.',
      'No access to unrelated files on your PC beyond what is listed here.',
    ],
  },
];
}

function CopyChip({ label, value }: CopyTarget) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), CLIPBOARD_ACK_MS);
    } catch (err) {
      toast.error({
        title: "That text couldn't be copied",
        body : 'Allow clipboard access in your browser settings, then try again.',
      });
    }
  };

  return (
    <Tooltip content   = {copied ? 'Copied!' : `Copy ${label}`}>
    <button  type      = "button" className = "transparency-copy-chip" onClick = {() => void copy()} aria-label = {`Copy ${label}`}>
    <span    className = "transparency-copy-chip-label">{label}</span>
    <code    className = "transparency-copy-chip-value">{value}</code>
      </button>
    </Tooltip>
  );
}

function CopyableEntriesPanel({ entries }: { entries: CopyableEntry[] }) {
  return (
    <ul className = "transparency-stored-list">
      {entries.map((entry) => (
        <li   key       = {entry.title} className = "transparency-stored-item">
        <div  className = "transparency-stored-head">
        <span className = "transparency-stored-title">{entry.title}</span>
        <p    className = "transparency-stored-description">{entry.description}</p>
          </div>
          {entry.copies.length > 0 ? (
            <div className = "transparency-copy-row">
              {entry.copies.map((copy) => (
                <CopyChip key = {`${entry.title}-${copy.value}`} {...copy} />
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function TransparencyPanel({ title, hint, items, copyable }: TransparencyBlock) {
  return (
    <section className = "surface-card settings-panel transparency-panel" data-tauri-drag-region>
    <div     className = "settings-panel-head" data-tauri-drag-region>
    <span    className = "settings-panel-title">{title}</span>
      </div>
      {hint ? <p className="settings-panel-hint">{hint}</p> : null}
      {copyable ? (
        <CopyableEntriesPanel entries = {copyable} />
      ) : (
        <ul className = "transparency-list">
          {(items ?? []).map((item, index) => (
            <li key = {index}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TransparencySection({ onOpenToolsMatch }: { onOpenToolsMatch?: () => void }) {
  return (
    <>
      {transparencyBlocks(onOpenToolsMatch).map((block) => (
        <TransparencyPanel key = {block.title} {...block} />
      ))}
      <p className = "settings-hint transparency-footnote" data-tauri-drag-region>
        Paths and keys above are safe to share. They do not include your passwords, tokens, or account data.
      </p>
    </>
  );
}