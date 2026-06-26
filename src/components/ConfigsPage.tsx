import { AnimatePresence, motion } from 'framer-motion';
import { Fragment, useState } from 'react';

import { useMouseGlow } from '../hooks/useMouseGlow';

const TABS = ['Aimbot', 'ESP', 'Visuals', 'Misc', 'Skin', 'Thirdperson', 'Effects', 'Setup'] as const;
type Tab = (typeof TABS)[number];

const BONE_OPTIONS = ['head', 'neck', 'chest', 'pelvis', 'feet'] as const;
type Bone = (typeof BONE_OPTIONS)[number];

type CheckItem = { label: string; checked: boolean };
type VisualItem = { label: string; checked: boolean } | { label: string; color: string };
type Range = { value: number; min: number; max: number };

type AimbotConfig = {
  smoothEnabled: boolean;
  smoothnessLabel?: string;
  smoothness: Range;
  aimfov: Range;
  autoWallbangLabel?: string;
  autoWallbang: boolean;
  thruSmoke: boolean;
  headboxAiming: boolean;
  prediction: boolean;
  nospread: boolean;
  aimkey: string;
  psilent: boolean;
  trigger: boolean;
  aimkey2: string;
  bone: Bone;
};

type EspConfig = { left: CheckItem[]; right: (CheckItem | null)[] };

type VisualsConfig = { left: VisualItem[]; right: (VisualItem | null)[] };

type MiscConfig = {
  left: CheckItem[];
  right: VisualItem[];
  agentKeybind: string;
  agent: string;
  lobbyButton: string;
  selfFovLabel?: string;
  selfFov: Range;
  aspectRatio: Range;
};

type EffectsConfig = {
  spectrumDist: Range;
  spectrumPower: Range;
  checks: CheckItem[];
  rightItems: VisualItem[];
  globalFov: Range;
};

type SkinConfig = {
  unlockLabel: string;
  collectionSkinChanger: boolean;
  ejectShells: boolean;
  buyBinds: boolean;
  buddyEnabled: boolean;
  buddyValue: Range;
  buddyName: string;
};

type ThirdpersonConfig = {
  enabled: boolean;
  bigWeapons: boolean;
  spin: boolean;
  antiAim: boolean;
  crosshair: boolean;
  backward: boolean;
  antiAimColor: string;
  height: Range;
  dist: Range;
  aspectRatio: Range;
  fov: Range;
  spinSpeed: Range;
};

type Preset = {
  name: string;
  note?: string;
  aimbot: AimbotConfig;
  esp?: EspConfig;
  visuals?: VisualsConfig;
  misc?: MiscConfig;
  effects?: EffectsConfig;
  skin?: SkinConfig;
  thirdperson?: ThirdpersonConfig;
};

const OFF_EFFECTS: EffectsConfig = {
  spectrumDist: { value: 0, min: 0, max: 5 },
  spectrumPower: { value: 0, min: 0, max: 1 },
  checks: [
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
};

const OFF_SKIN: SkinConfig = {
  unlockLabel: 'unlock all skins',
  collectionSkinChanger: false,
  ejectShells: false,
  buyBinds: true,
  buddyEnabled: false,
  buddyValue: { value: 0, min: 0, max: 999 },
  buddyName: 'Fist Bump Buddy',
};

const OFF_THIRDPERSON: ThirdpersonConfig = {
  enabled: false,
  bigWeapons: false,
  spin: false,
  antiAim: false,
  crosshair: false,
  backward: false,
  antiAimColor: '#000000',
  height: { value: 0, min: -50, max: 50 },
  dist: { value: 0, min: 0, max: 1000 },
  aspectRatio: { value: 1, min: 1, max: 3 },
  fov: { value: 90, min: 1, max: 160 },
  spinSpeed: { value: 0, min: 0, max: 10 },
};

const PRESETS: Preset[] = [
  {
    name: "pov's legit config",
    note: 'credits @forgotmyseed',
    aimbot: {
      smoothEnabled: true,
      smoothness: { value: 57, min: 1, max: 100 },
      aimfov: { value: 9.5, min: 1, max: 360 },
      autoWallbang: false,
      thruSmoke: false,
      headboxAiming: false,
      prediction: true,
      nospread: false,
      aimkey: 'Thumb Mouse Button 2',
      psilent: false,
      trigger: true,
      aimkey2: 'Thumb Mouse Button',
      bone: 'head',
    },
    esp: {
      left: [
        { label: '2D box', checked: false },
        { label: 'silhouette', checked: false },
        { label: 'silhouette weapon', checked: false },
        { label: 'abilities', checked: true },
        { label: 'spike triangle', checked: false },
        { label: 'health', checked: true },
        { label: 'weapon icons', checked: true },
        { label: 'util icons', checked: false },
        { label: 'recoil xhair', checked: false },
        { label: 'ping esp (key: N)', checked: true },
      ],
      right: [
        { label: '2.5D box', checked: false },
        { label: 'glow', checked: false },
        { label: 'silhouette util', checked: false },
        { label: 'gun on ground', checked: false },
        { label: 'spike timer', checked: true },
        { label: 'radar', checked: true },
        { label: 'agent icons', checked: true },
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
        { label: 'occluded color', color: '#f02bd6' },
        { label: 'wireframe hands', checked: false },
        { label: 'self fresnel', checked: false },
        { label: 'gun cham', checked: false },
      ],
      right: [
        { label: 'weapon outline', checked: false },
        { label: 'spike outline', checked: false },
        null,
        { label: 'projectile trail', checked: false },
        { label: 'fresnel color', color: '#22ff22' },
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
        { label: 'bunnyhop', checked: true },
        { label: 'antiflash', checked: false },
      ],
      right: [
        { label: 'cs2 inins', checked: false },
        { label: 'enemy doc head', checked: false },
        { label: 'dildo', checked: false },
        { label: 'ribon color', color: '#3a3aff' },
        { label: 'antiafk', checked: false },
        { label: 'autolocker', checked: false },
      ],
      agentKeybind: 'Jett',
      agent: 'agent',
      lobbyButton: 'go to lobby',
      selfFov: { value: 90, min: 1, max: 160 },
      aspectRatio: { value: 1.8, min: 1, max: 3 },
    },
    effects: {
      spectrumDist: { value: 1.0, min: 0, max: 5 },
      spectrumPower: { value: 0.2, min: 0, max: 1 },
      checks: [
        { label: 'skybox', checked: false },
        { label: 'apocalypse', checked: false },
        { label: 'spectrum', checked: false },
        { label: 'global fov', checked: false },
      ],
      rightItems: [
        { label: 'skybox color', color: '#cc22cc' },
        { label: 'hellfire', checked: false },
      ],
      globalFov: { value: 90, min: 1, max: 160 },
    },
    skin: {
      unlockLabel: 'unlock all skins',
      collectionSkinChanger: true,
      ejectShells: false,
      buyBinds: true,
      buddyEnabled: false,
      buddyValue: { value: 755, min: 0, max: 999 },
      buddyName: 'Potato Aim Buddy',
    },
    thirdperson: {
      enabled: false,
      bigWeapons: false,
      spin: false,
      antiAim: false,
      crosshair: false,
      backward: false,
      antiAimColor: '#000000',
      height: { value: 0.0, min: -50, max: 50 },
      dist: { value: 400.0, min: 0, max: 1000 },
      aspectRatio: { value: 1.8, min: 1, max: 3 },
      fov: { value: 110.0, min: 1, max: 160 },
      spinSpeed: { value: 3.6, min: 0, max: 10 },
    },
  }, {
    name: "C7's radiant config",
    note: 'credits: @blankdude1',
    aimbot: {
      smoothEnabled: true,
      smoothness: { value: 87.5, min: 1, max: 100 },
      aimfov: { value: 6.2, min: 1, max: 360 },
      autoWallbang: false,
      thruSmoke: false,
      headboxAiming: true,
      prediction: false,
      nospread: false,
      aimkey: 'Right Mouse Button',
      psilent: false,
      trigger: false,
      aimkey2: 'Middle Mouse Button',
      bone: 'head',
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
      agentKeybind: 'Chamber',
      agent: 'agent',
      lobbyButton: 'go to lobby',
      selfFov: { value: 90, min: 1, max: 160 },
      aspectRatio: { value: 1.8, min: 1, max: 3 },
    },
    effects: OFF_EFFECTS,
    skin: OFF_SKIN,
    thirdperson: OFF_THIRDPERSON,
  }, {
    name: "Hamad's legit config",
    note: 'credits: @h_amad',
    aimbot: {
      smoothEnabled: false,
      smoothness: { value: 0, min: 1, max: 100 },
      aimfov: { value: 1.0, min: 1, max: 360 },
      autoWallbang: false,
      thruSmoke: false,
      headboxAiming: false,
      prediction: false,
      nospread: false,
      aimkey: 'Left Mouse Button',
      psilent: false,
      trigger: false,
      aimkey2: 'Thumb Mouse Button',
      bone: 'head',
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
        { label: 'spike timer', checked: true },
        { label: 'radar', checked: true },
        { label: 'agent icons', checked: true },
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
        { label: 'occluded color', color: '#89CFF0' },
        { label: 'wireframe hands', checked: false },
        { label: 'self fresnel', checked: false },
        { label: 'gun cham', checked: false },
      ],
      right: [
        { label: 'weapon outline', checked: false },
        { label: 'spike outline', checked: false },
        { label: 'projectile trail', checked: false },
        { label: 'fresnel color', color: '#22ff22' },
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
        { label: 'bunnyhop', checked: true },
        { label: 'antiflash', checked: false },
      ],
      right: [
        { label: 'cs2 skins', checked: false },
        { label: 'enemy doc head', checked: false },
        { label: 'dildo', checked: true },
        { label: 'ribon color', color: '#4169E1' },
        { label: 'antiafk', checked: true },
        { label: 'autolocker', checked: false },
      ],
      agentKeybind: 'Reyna',
      agent: 'agent',
      lobbyButton: 'go to lobby',
      selfFov: { value: 82.5, min: 1, max: 160 },
      aspectRatio: { value: 1.8, min: 1, max: 3 },
    },
    effects: {
      spectrumDist: { value: 1.0, min: 0, max: 5 },
      spectrumPower: { value: 0.2, min: 0, max: 1 },
      checks: [
        { label: 'skybox', checked: true },
        { label: 'apocalypse', checked: false },
        { label: 'spectrum', checked: false },
        { label: 'global fov', checked: false },
      ],
      rightItems: [
        { label: 'skybox color', color: '#cc22cc' },
        { label: 'hellfire', checked: false },
      ],
      globalFov: { value: 90, min: 1, max: 160 },
    },
    skin: OFF_SKIN,
    thirdperson: OFF_THIRDPERSON,
  }, {
    name: ".'s config",
    note: 'credits: @unc6751',
    aimbot: {
      smoothEnabled: true,
      smoothness: { value: 37.4, min: 1, max: 100 },
      aimfov: { value: 19.4, min: 1, max: 360 },
      autoWallbang: false,
      thruSmoke: false,
      headboxAiming: false,
      prediction: false,
      nospread: false,
      aimkey: 'Thumb Mouse Button 2',
      psilent: false,
      trigger: false,
      aimkey2: 'Right Mouse Button',
      bone: 'head',
    },
    esp: {
      left: [
        { label: '2D box', checked: false },
        { label: 'silhouette', checked: false },
        { label: 'silhouette weapon', checked: false },
        { label: 'abilities', checked: true },
        { label: 'spike triangle', checked: true },
        { label: 'health', checked: true },
        { label: 'weapon icons', checked: false },
        { label: 'util icons', checked: false },
        { label: 'recoil xhair', checked: false },
        { label: 'ping esp (key: N)', checked: false },
      ],
      right: [
        { label: '2.5D box', checked: false },
        { label: 'glow', checked: true },
        { label: 'silhouette util', checked: true },
        { label: 'gun on ground', checked: false },
        { label: 'spike timer', checked: true },
        { label: 'radar', checked: true },
        { label: 'agent icons', checked: true },
        { label: 'snaplines', checked: false },
        { label: 'projectile traj', checked: false },
        { label: 'hat', checked: false },
      ],
    },
    visuals: {
      left: [
        { label: 'outline', checked: false },
        { label: 'weapon onground outline', checked: false },
        { label: 'util outline', checked: true },
        { label: 'custom fresnel color', checked: true },
        { label: 'occluded color', color: '#f02bd6' },
        { label: 'wireframe hands', checked: false },
        { label: 'self fresnel', checked: false },
        { label: 'gun cham', checked: false },
      ],
      right: [
        { label: 'weapon outline', checked: false },
        { label: 'spike outline', checked: true },
        { label: 'projectile trail', checked: false },
        { label: 'fresnel color', color: '#22ff22' },
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
        { label: 'bunnyhop', checked: true },
        { label: 'antiflash', checked: false },
      ],
      right: [
        { label: 'cs2 skins', checked: false },
        { label: 'enemy doc head', checked: false },
        { label: 'dildo', checked: true },
        { label: 'ribon color', color: '#3a3aff' },
        { label: 'antiafk', checked: true },
        { label: 'autolocker', checked: false },
      ],
      agentKeybind: 'Killjoy',
      agent: 'agent',
      lobbyButton: 'go to lobby',
      selfFov: { value: 90, min: 1, max: 160 },
      aspectRatio: { value: 1.8, min: 1, max: 3 },
    },
    effects: {
      spectrumDist: { value: 1.0, min: 0, max: 5 },
      spectrumPower: { value: 0.2, min: 0, max: 1 },
      checks: [
        { label: 'skybox', checked: false },
        { label: 'apocalypse', checked: false },
        { label: 'spectrum', checked: false },
        { label: 'global fov', checked: false },
      ],
      rightItems: [
        { label: 'skybox color', color: '#cc22cc' },
        { label: 'hellfire', checked: false },
      ],
      globalFov: { value: 90, min: 1, max: 160 },
    },
    skin: OFF_SKIN,
    thirdperson: OFF_THIRDPERSON,
  }, {
    name: "SUSPECT's radiant config",
    note: 'credits: @suspect2.1',
    aimbot: {
      smoothEnabled: true,
      smoothness: { value: 40.5, min: 1, max: 100 },
      aimfov: { value: 3.9, min: 1, max: 360 },
      autoWallbangLabel: 'vis check (key: =)',
      autoWallbang: false,
      thruSmoke: false,
      headboxAiming: false,
      prediction: true,
      nospread: false,
      aimkey: 'Thumb Mouse Button 2',
      psilent: false,
      trigger: false,
      aimkey2: 'Middle Mouse Button',
      bone: 'head',
    },
    esp: {
      left: [
        { label: '2D box', checked: false },
        { label: 'silhouette', checked: true },
        { label: 'silhouette util', checked: true },
        { label: 'abilities', checked: true },
        { label: 'spike triangle', checked: true },
        { label: 'health', checked: true },
        { label: 'weapon icons', checked: false },
        { label: 'util icons', checked: true },
        { label: 'recoil xhair', checked: true },
        { label: 'ping esp (key: N)', checked: false },
      ],
      right: [
        { label: '2.5D box', checked: false },
        { label: 'silhouette weapon', checked: true },
        { label: 'gun on ground', checked: false },
        { label: 'spike timer', checked: true },
        { label: 'radar', checked: true },
        { label: 'agent icons', checked: false },
        { label: 'snaplines', checked: false },
        { label: 'projectile traj', checked: true },
        { label: 'hat', checked: false },
      ],
    },
    visuals: {
      left: [
        { label: 'outline', checked: true },
        { label: 'weapon onground outline', checked: false },
        { label: 'util outline', checked: false },
        { label: 'custom fresnel color', checked: false },
        { label: 'outline color', color: '#f02bd6' },
        { label: 'wireframe hands', checked: false },
        { label: 'hands glow', checked: false },
        { label: 'gun cham', checked: false },
        { label: 'gun cham color (mask)', checked: false },
      ],
      right: [
        { label: 'weapon outline', checked: false },
        { label: 'spike outline', checked: false },
        { label: 'projectile trail', checked: false },
        { label: 'fresnel color', color: '#22ff22' },
        { label: 'wireframe gun', checked: false },
        { label: 'hands glow color', color: '#000000' },
        { label: 'gun glow color', color: '#22e2ff' },
      ],
    },
    misc: {
      left: [
        { label: 'bullet tracers', checked: false },
        { label: 'watermark', checked: false },
        { label: 'bunnyhop', checked: true },
        { label: 'antiflash', checked: false },
      ],
      right: [
        { label: 'cs2 skins', checked: false },
        { label: 'dildo', checked: false },
        { label: 'antiafk', checked: false },
        { label: 'autolocker', checked: true },
      ],
      agentKeybind: 'Sage',
      agent: 'agent',
      lobbyButton: 'disconnect',
      selfFovLabel: '1p fov',
      selfFov: { value: 97.6, min: 1, max: 160 },
      aspectRatio: { value: 1.7, min: 1, max: 3 },
    },
    effects: OFF_EFFECTS,
    skin: OFF_SKIN,
    thirdperson: OFF_THIRDPERSON,
  }, {
    name: "SysInfo's first person rage config",
    note: 'credits: @sysinfoxyz',
    aimbot: {
      smoothEnabled: true,
      smoothnessLabel: 'delay',
      smoothness: { value: 0.01, min: 0.01, max: 1 },
      aimfov: { value: 360.0, min: 1, max: 360 },
      autoWallbang: false,
      thruSmoke: false,
      headboxAiming: false,
      prediction: false,
      nospread: false,
      aimkey: 'Left Mouse Button',
      psilent: false,
      trigger: false,
      aimkey2: 'Right Mouse Button',
      bone: 'head',
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
        { label: 'glow', checked: true },
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
        { label: 'bullet tracers', checked: true },
        { label: 'self doc head', checked: false },
        { label: 'watermark', checked: false },
        { label: 'ribon', checked: false },
        { label: 'bunnyhop', checked: true },
        { label: 'antiflash', checked: true },
      ],
      right: [
        { label: 'cs2 skins', checked: true },
        { label: 'enemy doc head', checked: true },
        { label: 'dildo', checked: true },
        { label: 'ribon color', color: '#3a3aff' },
        { label: 'antiafk', checked: false },
        { label: 'autolocker', checked: false },
      ],
      agentKeybind: 'Raze',
      agent: 'agent',
      lobbyButton: 'go to lobby',
      selfFov: { value: 90, min: 1, max: 160 },
      aspectRatio: { value: 1.8, min: 1, max: 3 },
    },
    effects: OFF_EFFECTS,
    skin: OFF_SKIN,
    thirdperson: OFF_THIRDPERSON,
  }, {
    name: "SysInfo's legit config",
    note: 'credits: @sysinfoxyz',
    aimbot: {
      smoothEnabled: true,
      smoothness: { value: 4.8, min: 1, max: 100 },
      aimfov: { value: 2.5, min: 1, max: 360 },
      autoWallbang: true,
      thruSmoke: false,
      headboxAiming: false,
      prediction: false,
      nospread: false,
      aimkey: 'Thumb Mouse Button',
      psilent: false,
      trigger: false,
      aimkey2: 'Middle Mouse Button',
      bone: 'head',
    },
    esp: {
      left: [
        { label: '2D box', checked: false },
        { label: 'silhouette', checked: true },
        { label: 'silhouette weapon', checked: false },
        { label: 'abilities', checked: false },
        { label: 'spike triangle', checked: true },
        { label: 'health', checked: true },
        { label: 'weapon icons', checked: false },
        { label: 'util icons', checked: true },
        { label: 'recoil xhair', checked: false },
        { label: 'ping esp (key: N)', checked: false },
      ],
      right: [
        { label: '2.5D box', checked: false },
        { label: 'glow', checked: false },
        { label: 'silhouette util', checked: false },
        { label: 'gun on ground', checked: false },
        { label: 'spike timer', checked: true },
        { label: 'radar', checked: true },
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
        { label: 'occluded color', color: '#f02bd6' },
        { label: 'wireframe hands', checked: false },
        { label: 'self fresnel', checked: false },
        { label: 'gun cham', checked: false },
      ],
      right: [
        { label: 'weapon outline', checked: false },
        { label: 'spike outline', checked: false },
        null,
        { label: 'projectile trail', checked: false },
        { label: 'fresnel color', color: '#22ff22' },
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
        { label: 'ribon color', color: '#3a3aff' },
        { label: 'antiafk', checked: false },
        { label: 'autolocker', checked: false },
      ],
      agentKeybind: 'Omen',
      agent: 'agent',
      lobbyButton: 'go to lobby',
      selfFov: { value: 90, min: 1, max: 160 },
      aspectRatio: { value: 1.8, min: 1, max: 3 },
    },
    effects: OFF_EFFECTS,
    skin: OFF_SKIN,
    thirdperson: OFF_THIRDPERSON,
  },
];

export function ConfigsPage() {
  const glowRef = useMouseGlow<HTMLElement>();
  const [presetIndex, setPresetIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('Aimbot');
  const preset = PRESETS[presetIndex];

  return (
    <main className="configs-page" data-tauri-drag-region ref={glowRef}>
      <div className="w-full max-w-2xl text-white" data-tauri-drag-region>
        <select
          value={presetIndex}
          onChange={(e) => setPresetIndex(Number(e.target.value))}
          className="w-full cursor-pointer rounded-md bg-zinc-900/80 px-3 py-2 text-center text-xs font-bold tracking-widest text-white/70 uppercase outline-none"
        >
          {PRESETS.map((p, index) => (
            <option key={p.name} value={index} className="bg-zinc-900 text-white normal-case">
              {p.name}
            </option>
          ))}
        </select>

        <div className="mt-2 mb-4 text-center text-xs text-white/40" data-tauri-drag-region>{preset.note ?? ' '}</div>

        <div className="grid grid-cols-4 gap-2" data-tauri-drag-region>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md py-2.5 text-center text-sm font-bold transition-colors ${
                tab === activeTab ? 'bg-white text-black' : 'bg-zinc-900/80 text-white hover:bg-zinc-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${presetIndex}-${activeTab}`}
            className="mt-6"
            data-tauri-drag-region
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            {activeTab === 'Aimbot' ? (
              <AimbotTab config={preset.aimbot} />
            ) : activeTab === 'ESP' ? (
              preset.esp ? <EspTab config={preset.esp} /> : <NotAvailable />
            ) : activeTab === 'Visuals' ? (
              preset.visuals ? <VisualsTab config={preset.visuals} /> : <NotAvailable />
            ) : activeTab === 'Misc' ? (
              preset.misc ? <MiscTab config={preset.misc} /> : <NotAvailable />
            ) : activeTab === 'Effects' ? (
              preset.effects ? <EffectsTab config={preset.effects} /> : <NotAvailable />
            ) : activeTab === 'Skin' ? (
              preset.skin ? <SkinTab config={preset.skin} /> : <NotAvailable />
            ) : activeTab === 'Thirdperson' ? (
              preset.thirdperson ? <ThirdpersonTab config={preset.thirdperson} /> : <NotAvailable />
            ) : (
              <SetupTab />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

function AimbotTab({ config }: { config: AimbotConfig }) {
  return (
    <div className="grid grid-cols-2 items-center gap-x-10 gap-y-4" data-tauri-drag-region>
      {config.smoothEnabled ? (
        <>
          <MeterField label={config.smoothnessLabel ?? 'smoothness'} {...config.smoothness} />
          <MeterField label="aimfov" {...config.aimfov} />
        </>
      ) : (
        <div className="col-span-2">
          <MeterField label="aimfov" {...config.aimfov} />
        </div>
      )}

      <CheckField label={config.autoWallbangLabel ?? 'auto wallbang (key: =)'} checked={config.autoWallbang} />
      <CheckField label="thru smoke" checked={config.thruSmoke} />

      <CheckField label="headbox aiming" checked={config.headboxAiming} />
      <CheckField label="prediction" checked={config.prediction} />

      <CheckField label="smooth" checked={config.smoothEnabled} />
      <CheckField label="nospread" checked={config.nospread} />

      <KeyBox label={config.aimkey} />
      <SideLabel text="aimkey" />

      <CheckField label="psilent" checked={config.psilent} />
      <CheckField label="trigger" checked={config.trigger} />

      <KeyBox label={config.aimkey2} />
      <SideLabel text="aimkey 2" />

      {!config.headboxAiming && (
        <>
          <KeyBox label={capitalize(config.bone)} half />
          <SideLabel text="bone" />
        </>
      )}
    </div>
  );
}

function EspTab({ config }: { config: EspConfig }) {
  return (
    <div className="grid grid-cols-2 gap-x-10 gap-y-3" data-tauri-drag-region>
      {Array.from({ length: Math.max(config.left.length, config.right.length) }, (_, index) => (
        <Fragment key={index}>
          {config.left[index] ? <CheckField label={config.left[index].label} checked={config.left[index].checked} /> : <div />}
          {config.right[index] ? <CheckField label={config.right[index]!.label} checked={config.right[index]!.checked} /> : <div />}
        </Fragment>
      ))}
    </div>
  );
}

function VisualsTab({ config }: { config: VisualsConfig }) {
  return (
    <div className="grid grid-cols-2 items-center gap-x-10 gap-y-3" data-tauri-drag-region>
      {Array.from({ length: Math.max(config.left.length, config.right.length) }, (_, index) => (
        <Fragment key={index}>
          {config.left[index] ? <VisualField item={config.left[index]} /> : <div />}
          {config.right[index] ? <VisualField item={config.right[index]!} /> : <div />}
        </Fragment>
      ))}
    </div>
  );
}

function MiscTab({ config }: { config: MiscConfig }) {
  return (
    <div className="grid grid-cols-2 items-center gap-x-10 gap-y-3" data-tauri-drag-region>
      {config.left.map((item, index) => (
        <Fragment key={item.label}>
          <CheckField label={item.label} checked={item.checked} />
          <VisualField item={config.right[index]} />
        </Fragment>
      ))}

      <KeybindField buttonLabel={config.agentKeybind} sideLabel={config.agent} />
      <BoxField label={config.lobbyButton} />

      <MeterField label={config.selfFovLabel ?? 'self fov'} {...config.selfFov} />
      <MeterField label="aspect ratio" {...config.aspectRatio} />
    </div>
  );
}

function EffectsTab({ config }: { config: EffectsConfig }) {
  return (
    <div className="grid grid-cols-2 items-center gap-x-10 gap-y-3" data-tauri-drag-region>
      <SectionHeader label="low res" />
      <SectionHeader label="high res" />

      <MeterField label="spectrum dist" {...config.spectrumDist} />
      <MeterField label="spectrum power" {...config.spectrumPower} />

      <CheckField label={config.checks[0].label} checked={config.checks[0].checked} />
      <VisualField item={config.rightItems[0]} />

      <CheckField label={config.checks[1].label} checked={config.checks[1].checked} />
      <VisualField item={config.rightItems[1]} />

      <CheckField label={config.checks[2].label} checked={config.checks[2].checked} />
      <div />

      <CheckField label={config.checks[3].label} checked={config.checks[3].checked} />
      <div />

      <MeterField label="global fov" {...config.globalFov} />
      <div />
    </div>
  );
}

function SkinTab({ config }: { config: SkinConfig }) {
  return (
    <div className="grid grid-cols-2 items-center gap-x-10 gap-y-3" data-tauri-drag-region>
      <BoxField label={config.unlockLabel} />
      <div />

      <CheckField label="collection skin changer" checked={config.collectionSkinChanger} />
      <div />

      <CheckField label="eject shells" checked={config.ejectShells} />
      <CheckField label="buy binds" checked={config.buyBinds} />

      <CheckField label="buddy" checked={config.buddyEnabled} />
      <div />

      <MeterField label="buddy" {...config.buddyValue} />
      <div />

      <div className="text-sm font-semibold" data-tauri-drag-region>
        {config.buddyName}
      </div>
    </div>
  );
}

function ThirdpersonTab({ config }: { config: ThirdpersonConfig }) {
  if (!config.enabled) {
    return (
      <div className="grid grid-cols-2 items-center gap-x-10 gap-y-3" data-tauri-drag-region>
        <CheckField label="thirdperson (backspace)" checked={config.enabled} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 items-center gap-x-10 gap-y-3" data-tauri-drag-region>
      <CheckField label="thirdperson (backspace)" checked={config.enabled} />
      <div />

      <CheckField label="big weapons" checked={config.bigWeapons} />
      <CheckField label="crosshair" checked={config.crosshair} />

      <CheckField label="spin" checked={config.spin} />
      <CheckField label="backward" checked={config.backward} />

      <CheckField label="anti aim" checked={config.antiAim} />
      <ColorField label="antiaim color" color={config.antiAimColor} />

      <MeterField label="height" {...config.height} />
      <MeterField label="dist" {...config.dist} />

      <MeterField label="aspect ratio" {...config.aspectRatio} />
      <MeterField label="fov" {...config.fov} />

      <MeterField label="spin speed" {...config.spinSpeed} />
    </div>
  );
}

function SetupTab() {
  return (
    <div className="grid grid-cols-2 gap-3" data-tauri-drag-region>
      <SetupButton label="save config" />
      <SetupButton label="load config" />
      <SetupButton label="delete config" />
      <div />
      <SetupButton label="load mod" />
    </div>
  );
}

function SetupButton({ label }: { label: string }) {
  return (
    <button className="rounded bg-black px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-zinc-800">
      {label}
    </button>
  );
}

function NotAvailable() {
  return (
    <div className="flex h-48 items-center justify-center text-sm font-semibold text-white/40" data-tauri-drag-region>
      N/A
    </div>
  );
}

function MeterField({ label, value, min, max }: { label: string; value: number; min: number; max: number }) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div data-tauri-drag-region>
      <div className="mb-2 text-sm font-semibold lowercase" data-tauri-drag-region>
        {label}
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/15" data-tauri-drag-region>
        <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1 text-center text-sm" data-tauri-drag-region>
        {value.toFixed(1)}
      </div>
    </div>
  );
}

function CheckField({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold lowercase" data-tauri-drag-region>
      <div className={`flex h-4 w-4 items-center justify-center rounded-sm border border-white/20 ${checked ? 'bg-white' : 'bg-white/10'}`}>
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
            <path d="M5 12l5 5L19 7" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {label}
    </div>
  );
}

function ColorField({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold lowercase" data-tauri-drag-region>
      <div className="h-4 w-4 rounded-sm border border-white/20" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}

function VisualField({ item }: { item: VisualItem }) {
  return 'color' in item ? <ColorField label={item.label} color={item.color} /> : <CheckField label={item.label} checked={item.checked} />;
}

function KeybindField({ buttonLabel, sideLabel }: { buttonLabel: string; sideLabel: string }) {
  return (
    <div className="flex items-center gap-3" data-tauri-drag-region>
      <div
        className="flex-1 cursor-pointer rounded bg-black px-3 py-1 text-center text-sm leading-tight font-semibold text-white transition-colors hover:bg-zinc-800"
        data-tauri-drag-region
      >
        {buttonLabel}
      </div>
      <span className="text-sm lowercase" data-tauri-drag-region>
        {sideLabel}
      </span>
    </div>
  );
}

function BoxField({ label }: { label: string }) {
  return (
    <div
      className="cursor-pointer rounded bg-black px-3 py-1 text-center text-sm leading-tight font-semibold text-white transition-colors hover:bg-zinc-800"
      data-tauri-drag-region
    >
      {label}
    </div>
  );
}

function KeyBox({ label, half }: { label: string; half?: boolean }) {
  return (
    <div
      className={`${half ? 'w-1/2' : 'w-full'} cursor-pointer rounded bg-black px-3 py-1 text-center text-sm leading-tight font-semibold text-white transition-colors hover:bg-zinc-800`}
      data-tauri-drag-region
    >
      {label}
    </div>
  );
}

function SideLabel({ text }: { text: string }) {
  return (
    <span className="text-sm lowercase" data-tauri-drag-region>
      {text}
    </span>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      className="cursor-pointer rounded bg-black py-2 text-center text-sm font-bold lowercase text-white transition-colors hover:bg-zinc-800"
      data-tauri-drag-region
    >
      {label}
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
