import type { ConfigPerspective, ConfigType } from '../../types';

export const TYPE_FILTERS = ['all', 'legit', 'semi_legit', 'semi_rage', 'rage'] as const;

export const TYPE_LABELS: Record<ConfigType, string> = {
  legit     : 'Legit',
  semi_legit: 'Semi Legit',
  semi_rage : 'Semi Rage',
  rage      : 'Rage',
};

export const PERSPECTIVE_LABELS: Record<ConfigPerspective, string> = {
  first_person: '1st person',
  third_person: '3rd person',
};

export const TABS = ['Aimbot', 'ESP', 'Visuals', 'Misc', 'Skin', 'Thirdperson', 'Effects'] as const;

export const CONFIG_TYPES = ['legit', 'semi_legit', 'semi_rage', 'rage'] as const satisfies readonly ConfigType[];

export const CONFIG_PERSPECTIVES = ['first_person', 'third_person'] as const satisfies readonly ConfigPerspective[];

export const BONE_OPTIONS = ['head', 'neck', 'chest', 'stomach', 'abdomen', 'pelvis'] as const;

export const BONE_LABELS: Record<(typeof BONE_OPTIONS)[number], string> = {
  head   : 'Head',
  neck   : 'Neck',
  chest  : 'Chest',
  stomach: 'Stomach',
  abdomen: 'Abdomen',
  pelvis : 'Pelvis',
};

export const BONE_DROPDOWN_OPTIONS = BONE_OPTIONS.map((bone) => ({
  value: bone,
  label: BONE_LABELS[bone],
}));

export const AIM_KEY_OPTIONS = [
  'Left Mouse Button',
  'Right Mouse Button',
  'Middle Mouse Button',
  'Thumb Mouse Button',
  'Thumb Mouse Button 2',
] as const;

export const AIM_KEY_DROPDOWN_OPTIONS = AIM_KEY_OPTIONS.map((key) => ({
  value: key,
  label: key,
}));