import { AnimatePresence, motion } from 'framer-motion';

import type { AuthSession, CommunityConfig, ConfigPerspective, ConfigType } from '../../types';
import {
  AimbotTab,
  EffectsTab,
  EspTab,
  MiscTab,
  SkinTab,
  ThirdpersonTab,
  VisualsTab,
} from './ConfigEditorTabs';
import { NotAvailable }                    from './ConfigEditorFields';
import { PERSPECTIVE_LABELS, TYPE_LABELS } from './constants';
import { toPreset }                        from './preset';
import type { Preset, Tab }                from './types';

export function typeBadgeText(config: CommunityConfig): string | null {
  if (!config.type) return null;
  if (config.type === 'rage' && config.perspective) return `${TYPE_LABELS.rage} | ${PERSPECTIVE_LABELS[config.perspective]}`;
  return TYPE_LABELS[config.type];
}
export function isLegacyCreditNote(note: string | null): boolean {
  return !!note?.trim() && LEGACY_CREDIT_PATTERN.test(note.trim());
}

export function posterDisplayName(config: CommunityConfig): string {
  if (config.discordUsername) return config.discordUsername;
  const match = LEGACY_CREDIT_PATTERN.exec(config.note?.trim() ?? '');
  if (match) return match[1].startsWith('@') ? match[1]: `@${match[1]}`;
  return 'Community';
}

export function configDescription(config: CommunityConfig): string | null {
  const note = config.note?.trim();
  if (!note) return null;
  if (!config.discordUsername && isLegacyCreditNote(note)) return null;
  return note;
}

export function sessionCreditLabel(session: AuthSession): string {
  if (session.discordUsername) return session.discordUsername;
  return session.isGuest ? 'Guest': 'You';
}

export function isOwnConfig(config: CommunityConfig, session: AuthSession | null): boolean {
  return !!session?.userId && config.userId === session.userId;
}

export function editorSeedFromConfig(config: CommunityConfig) {
  return {
    name       : config.name,
    description: config.note ?? '',
    configType : (config.type ?? 'legit') as ConfigType,
    perspective: (config.perspective ?? '') as ConfigPerspective | '',
    preset     : toPreset(config),
  };
}

export function suggestedConfigTitle(session: AuthSession | null, configType: ConfigType): string {
  const typeLabel = TYPE_LABELS[configType].toLowerCase();
  if (session?.discordUsername) return `${session.discordUsername}'s ${typeLabel} config`;
  return `My ${typeLabel} config`;
}


export function ConfigTabBar({ tabs, activeTab, onChange }: { tabs: readonly Tab[]; activeTab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div className = "app-tab-bar drag-surface" role = "tablist">
      {tabs.map((tab) => (
        <button
          key           = {tab}
          type          = "button"
          role          = "tab"
          aria-selected = {tab === activeTab}
          onClick       = {() => onChange(tab)}
          className     = {`app-tab-button${tab === activeTab ? ' active' : ''}`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export function ConfigTabPanel({
  preset,
  activeTab,
  editable,
  onPresetChange,
}: {
  preset         : Preset;
  activeTab      : Tab;
  editable      ?: boolean;
  onPresetChange?: (preset: Preset) => void;
}) {
  const patch = editable && onPresetChange ? onPresetChange : undefined;

  return (
    <AnimatePresence mode = "wait">
      <motion.div
        key        = {activeTab}
        className  = "app-tab-panel configs-tab-panel drag-surface"
        initial    = {{ opacity: 0 }}
        animate    = {{ opacity: 1 }}
        exit       = {{ opacity: 0 }}
        transition = {{ duration: 0.14 }}
      >
        {activeTab === 'Aimbot' ? (
          <AimbotTab
            config   = {preset.aimbot}
            editable = {editable}
            onChange = {patch ? (aimbot) => patch({ ...preset, aimbot }) : undefined}
          />
        ) : activeTab === 'ESP' ? (
          preset.esp ? (
            <EspTab
              config   = {preset.esp}
              editable = {editable}
              onChange = {patch ? (esp) => patch({ ...preset, esp }) : undefined}
            />
          ) : (
            <NotAvailable />
          )
        ) : activeTab === 'Visuals' ? (
          preset.visuals ? (
            <VisualsTab
              config   = {preset.visuals}
              editable = {editable}
              onChange = {patch ? (visuals) => patch({ ...preset, visuals }) : undefined}
            />
          ) : (
            <NotAvailable />
          )
        ) : activeTab === 'Misc' ? (
          preset.misc ? (
            <MiscTab
              config   = {preset.misc}
              editable = {editable}
              onChange = {patch ? (misc) => patch({ ...preset, misc }) : undefined}
            />
          ) : (
            <NotAvailable />
          )
        ) : activeTab === 'Effects' ? (
          preset.effects ? (
            <EffectsTab
              config   = {preset.effects}
              editable = {editable}
              onChange = {patch ? (effects) => patch({ ...preset, effects }) : undefined}
            />
          ) : (
            <NotAvailable />
          )
        ) : activeTab === 'Skin' ? (
          preset.skin ? (
            <SkinTab
              config   = {preset.skin}
              editable = {editable}
              onChange = {patch ? (skin) => patch({ ...preset, skin }) : undefined}
            />
          ) : (
            <NotAvailable />
          )
        ) : activeTab === 'Thirdperson' ? (
          preset.thirdperson ? (
            <ThirdpersonTab
              config   = {preset.thirdperson}
              editable = {editable}
              onChange = {patch ? (thirdperson) => patch({ ...preset, thirdperson }) : undefined}
            />
          ) : (
            <NotAvailable />
          )
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}

const TITLE_PATTERN = /^.+?'s\s+(.+?)\s+config$/i;
export function cleanTitle(name: string): string {
  const match = TITLE_PATTERN.exec(name.trim());
  return match ? match[1]: name;
}
export function ThumbUpIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox = "0 0 24 24" fill = {active ? 'currentColor' : 'none'} aria-hidden = "true" className = "h-3.5 w-3.5">
      <path
        d              = "M7 11v9H3v-9h4Zm2 9V11l5-7 1 1-1 6h6.5a1.5 1.5 0 0 1 1.46 1.84l-1.5 6A1.5 1.5 0 0 1 19 20H9Z"
        stroke         = "currentColor"
        strokeWidth    = "1.6"
        strokeLinejoin = "round"
      />
    </svg>
  );
}

export function ThumbDownIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox = "0 0 24 24" fill = {active ? 'currentColor' : 'none'} aria-hidden = "true" className = "h-3.5 w-3.5">
      <path
        d              = "M17 13V4h4v9h-4Zm-2-9v9l-5 7-1-1 1-6H3.5A1.5 1.5 0 0 1 2.04 11.16l1.5-6A1.5 1.5 0 0 1 5 4h10Z"
        stroke         = "currentColor"
        strokeWidth    = "1.6"
        strokeLinejoin = "round"
      />
    </svg>
  );
}

export function AvatarFallbackIcon() {
  return (
    <svg    viewBox = "0 0 24 24" fill                         = "none" aria-hidden         = "true" className    = "h-3.5 w-3.5">
    <circle cx      = "12" cy                                  = "8" r                      = "3.2" stroke        = "currentColor" strokeWidth = "1.6" />
    <path   d       = "M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke = "currentColor" strokeWidth = "1.6" strokeLinecap = "round" />
    </svg>
  );
}

export function CommentIcon() {
  return (
    <svg viewBox = "0 0 24 24" fill = "none" aria-hidden = "true" className = "h-3.5 w-3.5">
      <path
        d              = "M21 12a8.5 8.5 0 1 1-3.6-6.95L21 4l-1.1 4.3A8.46 8.46 0 0 1 21 12Z"
        stroke         = "currentColor"
        strokeWidth    = "1.6"
        strokeLinecap  = "round"
        strokeLinejoin = "round"
      />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg  viewBox = "0 0 24 24" fill         = "none" aria-hidden         = "true" className  = "h-3.5 w-3.5">
    <path d       = "M15 18l-6-6 6-6" stroke = "currentColor" strokeWidth = "2" strokeLinecap = "round" strokeLinejoin = "round" />
    </svg>
  );
}

export function ConfigBackBar({ destination, onBack }: { destination: string; onBack: () => void }) {
  return (
    <div    className = "configs-detail-topbar drag-surface">
    <button type      = "button" className = "configs-detail-back" onClick = {onBack} aria-label = {`Back to ${destination}`}>
        <BackIcon />
        <span className = "configs-detail-back-label">{destination}</span>
      </button>
    </div>
  );
}

const LEGACY_CREDIT_PATTERN = /^credits?:?\s*(@?\S+)\s*$/i;

