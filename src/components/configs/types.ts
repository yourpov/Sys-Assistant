import type { CommunityConfig } from '../../types';

export type TypeFilter = 'all'    | 'legit' | 'semi_legit' | 'semi_rage' | 'rage';

export type Tab        = 'Aimbot' | 'ESP'   | 'Visuals'    | 'Misc'      | 'Skin' | 'Thirdperson' | 'Effects';

export type Bone       = 'head'   | 'neck'  | 'chest'      | 'stomach'   | 'abdomen' | 'pelvis';

export type AimKey     = 'Left Mouse Button' | 'Right Mouse Button' | 'Middle Mouse Button' | 'Thumb Mouse Button' | 'Thumb Mouse Button 2';

export type CheckItem  = { label: string; checked: boolean };
export type VisualItem = { label: string; checked: boolean } | { label: string; color: string };
export type Range      = { value: number; min: number; max: number };

export type AimbotConfig = {
  smoothEnabled     : boolean;
  smoothnessLabel  ?: string;
  smoothness        : Range;
  aimfov            : Range;
  autoWallbangLabel?: string;
  autoWallbang      : boolean;
  thruSmoke         : boolean;
  headboxAiming     : boolean;
  prediction        : boolean;
  nospread          : boolean;
  aimkey            : AimKey | '';
  psilent           : boolean;
  trigger           : boolean;
  aimkey2           : AimKey | '';
  bone              : Bone;
};

export type EspConfig = { left: CheckItem[]; right: (CheckItem | null)[] };

export type VisualsConfig = { left: VisualItem[]; right: (VisualItem | null)[] };

export type MiscConfig = {
  left         : CheckItem[];
  right        : VisualItem[];
  agentKeybind : string;
  agent        : string;
  lobbyButton  : string;
  selfFovLabel?: string;
  selfFov      : Range;
  aspectRatio  : Range;
};

export type EffectsConfig = {
  spectrumDist : Range;
  spectrumPower: Range;
  checks       : CheckItem[];
  rightItems   : VisualItem[];
  globalFov    : Range;
};

export type SkinConfig = {
  unlockLabel          : string;
  collectionSkinChanger: boolean;
  ejectShells          : boolean;
  buyBinds             : boolean;
  buddyEnabled         : boolean;
  buddyValue           : Range;
  buddyName            : string;
};

export type ThirdpersonConfig = {
  enabled     : boolean;
  bigWeapons  : boolean;
  spin        : boolean;
  antiAim     : boolean;
  crosshair   : boolean;
  backward    : boolean;
  antiAimColor: string;
  height      : Range;
  dist        : Range;
  aspectRatio : Range;
  fov         : Range;
  spinSpeed   : Range;
};

export type Preset = {
  name        : string;
  note       ?: string;
  aimbot      : AimbotConfig;
  esp        ?: EspConfig;
  visuals    ?: VisualsConfig;
  misc       ?: MiscConfig;
  effects    ?: EffectsConfig;
  skin       ?: SkinConfig;
  thirdperson?: ThirdpersonConfig;
};

export type ShareStep = 'build' | 'publish';

export type EditorTarget = { kind: 'create' } | { kind: 'edit'; config: CommunityConfig };