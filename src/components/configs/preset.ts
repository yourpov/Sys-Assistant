import type { CommunityConfig }      from '../../types';
import { AIM_KEY_OPTIONS, BONE_OPTIONS } from './constants';
import type { AimbotConfig, AimKey, Bone, Preset } from './types';

function normalizeBone(bone: string): Bone {
  if ((BONE_OPTIONS as readonly string[]).includes(bone)) return bone as Bone;
  if (bone === 'feet') return 'pelvis';
  return 'head';
}

function normalizeAimKey(key: string): AimKey | '' {
  return (AIM_KEY_OPTIONS as readonly string[]).includes(key) ? (key as AimKey) : '';
}

export function normalizeAimbotConfig(aimbot: AimbotConfig): AimbotConfig {
  const normalized = {
    ...aimbot,
    bone   : normalizeBone(aimbot.bone),
    aimkey : normalizeAimKey(aimbot.aimkey),
    aimkey2: normalizeAimKey(aimbot.aimkey2),
  };
  if (!normalized.psilent || !normalized.trigger) return normalized;
  return { ...normalized, trigger: false };
}

export function toPreset(config: CommunityConfig): Preset {
  const preset                        = { name: config.name, note: config.note ?? undefined, ...(config.data as Omit<Preset, 'name' | 'note'>) };
  if    (preset.aimbot) preset.aimbot = normalizeAimbotConfig(preset.aimbot);
  return preset;
}
const DEFAULT_OFF_PRESET: Preset = {
  name  : '',
  aimbot: {
    smoothEnabled: false,
    smoothness   : { value: 1, min: 1, max: 100 },
    aimfov       : { value: 1, min: 1, max: 360 },
    autoWallbang : false,
    thruSmoke    : false,
    headboxAiming: false,
    prediction   : false,
    nospread     : false,
    aimkey       : '',
    psilent      : false,
    trigger      : false,
    aimkey2      : '',
    bone         : 'head',
  },
  esp: {
    left: [
      { label: '2D box', checked: false },
      { label: 'silhouette', checked: false },
      { label: 'silhouette weapon', checked: false },
      { label: 'abilities', checked: false },
      { label: 'spike triangle', checked: false },
      { label: 'health', checked: false },
      { label: 'weapon icons', checked: false },
      { label: 'util icons', checked: false },
      { label: 'recoil xhair', checked: false },
      { label: 'ping esp (key: N)', checked: false },
    ],
    right: [
      { label: '2.5D box', checked: false },
      { label: 'glow', checked: false },
      { label: 'silhouette util', checked: false },
      { label: 'gun on ground', checked: false },
      { label: 'spike timer', checked: false },
      { label: 'radar', checked: false },
      { label: 'agent icons', checked: false },
      { label: 'snaplines', checked: false },
      { label: 'projectile traj', checked: false },
      { label: 'hat', checked: false },
    ],
  },
  visuals: {
    left: [
      { label: 'outline', checked: false },
      { label: 'weapon onground outline', checked: false },
      { label: 'util outline', checked: false },
      { label: 'custom fresnel color', checked: false },
      { label: 'occluded color', color: '#000000' },
      { label: 'wireframe hands', checked: false },
      { label: 'self fresnel', checked: false },
      { label: 'gun cham', checked: false },
    ],
    right: [
      { label: 'weapon outline', checked: false },
      { label: 'spike outline', checked: false },
      null,
      { label: 'projectile trail', checked: false },
      { label: 'fresnel color', color: '#000000' },
      { label: 'wireframe gun', checked: false },
      { label: 'self fresnel color', color: '#000000' },
    ],
  },
  misc: {
    left: [
      { label: 'bullet tracers', checked: false },
      { label: 'self doc head', checked: false },
      { label: 'watermark', checked: false },
      { label: 'ribon', checked: false },
      { label: 'bunnyhop', checked: false },
      { label: 'antiflash', checked: false },
    ],
    right: [
      { label: 'cs2 skins', checked: false },
      { label: 'enemy doc head', checked: false },
      { label: 'dildo', checked: false },
      { label: 'ribon color', color: '#000000' },
      { label: 'antiafk', checked: false },
      { label: 'autolocker', checked: false },
    ],
    agentKeybind: 'Jett',
    agent       : 'agent',
    lobbyButton : 'go to lobby',
    selfFov     : { value: 90, min: 1, max: 160 },
    aspectRatio : { value: 1.8, min: 1, max: 3 },
  },
  effects: {
    spectrumDist : { value: 0, min: 0, max: 5 },
    spectrumPower: { value: 0, min: 0, max: 1 },
    checks       : [
      { label: 'skybox', checked: false },
      { label: 'apocalypse', checked: false },
      { label: 'spectrum', checked: false },
      { label: 'global fov', checked: false },
    ],
    rightItems: [
      { label: 'skybox color', color: '#000000' },
      { label: 'hellfire', checked: false },
    ],
    globalFov: { value: 90, min: 1, max: 160 },
  },
  skin: {
    unlockLabel          : 'unlock all skins',
    collectionSkinChanger: false,
    ejectShells          : false,
    buyBinds             : false,
    buddyEnabled         : false,
    buddyValue           : { value: 0, min: 0, max: 999 },
    buddyName            : '',
  },
  thirdperson: {
    enabled     : false,
    bigWeapons  : false,
    spin        : false,
    antiAim     : false,
    crosshair   : false,
    backward    : false,
    antiAimColor: '#000000',
    height      : { value: 0, min: -50, max: 50 },
    dist        : { value: 0, min: 0, max: 1000 },
    aspectRatio : { value: 1, min: 1, max: 3 },
    fov         : { value: 90, min: 1, max: 160 },
    spinSpeed   : { value: 0, min: 0, max: 10 },
  },
};

export function cloneDefaultOffPreset(): Preset {
  return structuredClone(DEFAULT_OFF_PRESET);
}

export function presetToPostData(preset: Preset): Record<string, unknown> {
  const { name: _name, note: _note, ...data } = preset;
  return data;
}

