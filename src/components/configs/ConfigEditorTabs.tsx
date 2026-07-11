import { Fragment } from 'react';

import { Dropdown }                                                                                                                from '../Dropdown';
import { BONE_DROPDOWN_OPTIONS, BONE_LABELS }                                                                                      from './constants';
import type { AimbotConfig, Bone, EffectsConfig, EspConfig, MiscConfig, SkinConfig, ThirdpersonConfig, VisualItem, VisualsConfig } from './types';
import {
  AgentField,
  AimKeyField,
  BoxField,
  CheckField,
  ColorField,
  KeyBox,
  MeterField,
  SectionHeader,
  SideLabel,
  TextField,
  VisualField,
} from './ConfigEditorFields';

export function AimbotTab({
  config,
  editable,
  onChange,
}: {
  config   : AimbotConfig;
  editable?: boolean;
  onChange?: (config: AimbotConfig) => void;
}) {
  const patch = (partial: Partial<AimbotConfig>) => {
    if (editable && onChange) onChange({ ...config, ...partial });
  };

  return (
    <div className = "configs-editor-grid grid grid-cols-2 items-center gap-x-10 gap-y-4">
      {config.smoothEnabled ? (
        <>
          <MeterField
            label = {config.smoothnessLabel ?? 'smoothness'}
            {...config.smoothness}
            onChange = {editable ? (value) => patch({ smoothness: { ...config.smoothness, value } }) : undefined}
          />
          <MeterField
            label = "aimfov"
            {...config.aimfov}
            onChange = {editable ? (value) => patch({ aimfov: { ...config.aimfov, value } }) : undefined}
          />
        </>
      ) : (
        <div className = "col-span-2">
          <MeterField
            label = "aimfov"
            {...config.aimfov}
            onChange = {editable ? (value) => patch({ aimfov: { ...config.aimfov, value } }) : undefined}
          />
        </div>
      )}

      <CheckField
        label    = {config.autoWallbangLabel ?? 'auto wallbang (key: =)'}
        checked  = {config.autoWallbang}
        onChange = {editable ? (checked) => patch({ autoWallbang: checked }) : undefined}
      />
      <CheckField
        label    = "thru smoke"
        checked  = {config.thruSmoke}
        onChange = {editable ? (checked) => patch({ thruSmoke: checked }) : undefined}
      />

      <CheckField
        label    = "headbox aiming"
        checked  = {config.headboxAiming}
        onChange = {editable ? (checked) => patch({ headboxAiming: checked }) : undefined}
      />
      <CheckField
        label    = "prediction"
        checked  = {config.prediction}
        onChange = {editable ? (checked) => patch({ prediction: checked }) : undefined}
      />

      <CheckField
        label    = "smooth"
        checked  = {config.smoothEnabled}
        onChange = {editable ? (checked) => patch({ smoothEnabled: checked }) : undefined}
      />
      <CheckField
        label    = "nospread"
        checked  = {config.nospread}
        onChange = {editable ? (checked) => patch({ nospread: checked }) : undefined}
      />

      <AimKeyField
        value     = {config.aimkey}
        sideLabel = "aimkey"
        editable  = {editable}
        onChange  = {editable ? (aimkey) => patch({ aimkey }) : undefined}
      />

      <CheckField
        label    = "psilent"
        checked  = {config.psilent}
        onChange = {
          editable
            ? (checked) => patch({ psilent: checked, ...(checked ? { trigger: false } : {}) })
            :   undefined
        }
      />
      <CheckField
        label    = "trigger"
        checked  = {config.trigger}
        onChange = {
          editable
            ? (checked) => patch({ trigger: checked, ...(checked ? { psilent: false } : {}) })
            :   undefined
        }
      />

      <AimKeyField
        value     = {config.aimkey2}
        sideLabel = "aimkey 2"
        editable  = {editable}
        onChange  = {editable ? (aimkey2) => patch({ aimkey2 }) : undefined}
      />

      {!config.headboxAiming &&
        (editable ? (
          <>
            <Dropdown
              value     = {config.bone}
              onChange  = {(value) => patch({ bone: value as Bone })}
              options   = {BONE_DROPDOWN_OPTIONS}
              className = "configs-bone-dropdown"
            />
            <SideLabel text = "bone" />
          </>
        ) : (
          <>
            <KeyBox    label = {BONE_LABELS[config.bone] ?? config.bone} half />
            <SideLabel text  = "bone" />
          </>
        ))}
    </div>
  );
}

export function EspTab({
  config,
  editable,
  onChange,
}: {
  config   : EspConfig;
  editable?: boolean;
  onChange?: (config: EspConfig) => void;
}) {
  const patchSide = (side: 'left' | 'right', index: number, checked: boolean) => {
    if (!editable || !onChange) return;
    const items = config[side].map((item, i) => (i === index && item ? { ...item, checked } : item));
    onChange({ ...config, [side]: items });
  };

  return (
    <div className = "configs-editor-grid grid grid-cols-2 gap-x-10 gap-y-3">
      {Array.from({ length: Math.max(config.left.length, config.right.length) }, (_, index) => (
        <Fragment key = {index}>
          {config.left[index] ? (
            <CheckField
              label    = {config.left[index].label}
              checked  = {config.left[index].checked}
              onChange = {editable ? (checked) => patchSide('left', index, checked) : undefined}
            />
          ) : (
            <div />
          )}
          {config.right[index] ? (
            <CheckField
              label    = {config.right[index]!.label}
              checked  = {config.right[index]!.checked}
              onChange = {editable ? (checked) => patchSide('right', index, checked) : undefined}
            />
          ) : (
            <div />
          )}
        </Fragment>
      ))}
    </div>
  );
}

export function VisualsTab({
  config,
  editable,
  onChange,
}: {
  config   : VisualsConfig;
  editable?: boolean;
  onChange?: (config: VisualsConfig) => void;
}) {
  const patchSide = (side: 'left' | 'right', index: number, next: VisualItem) => {
    if (!editable || !onChange) return;
    const items = config[side].map((item, i) => (i === index ? next : item));
    onChange({ ...config, [side]: items });
  };

  return (
    <div className = "configs-editor-grid grid grid-cols-2 items-center gap-x-10 gap-y-3">
      {Array.from({ length: Math.max(config.left.length, config.right.length) }, (_, index) => (
        <Fragment key = {index}>
          {config.left[index] ? (
            <VisualField
              item     = {config.left[index]}
              onChange = {editable ? (next) => patchSide('left', index, next) : undefined}
            />
          ) : (
            <div />
          )}
          {config.right[index] ? (
            <VisualField
              item     = {config.right[index]!}
              onChange = {editable ? (next) => patchSide('right', index, next) : undefined}
            />
          ) : (
            <div />
          )}
        </Fragment>
      ))}
    </div>
  );
}

export function MiscTab({
  config,
  editable,
  onChange,
}: {
  config   : MiscConfig;
  editable?: boolean;
  onChange?: (config: MiscConfig) => void;
}) {
  const patch = (partial: Partial<MiscConfig>) => {
    if (editable && onChange) onChange({ ...config, ...partial });
  };

  return (
    <div className = "configs-editor-grid grid grid-cols-2 items-center gap-x-10 gap-y-3">
      {config.left.map((item, index) => (
        <Fragment key = {item.label}>
          <CheckField
            label    = {item.label}
            checked  = {item.checked}
            onChange = {
              editable
                ? (checked) => 
                    patch({
                      left: config.left.map((entry, i) => (i === index ? { ...entry, checked } : entry)),
                    })
                :   undefined
            }
          />
          <VisualField
            item     = {config.right[index]}
            onChange = {
              editable
                ? (next) => 
                    patch({
                      right: config.right.map((entry, i) => (i === index ? next : entry)),
                    })
                :   undefined
            }
          />
        </Fragment>
      ))}

      <AgentField
        agent     = {config.agentKeybind}
        sideLabel = {config.agent}
        editable  = {editable}
        onChange  = {editable ? (agent) => patch({ agentKeybind: agent }) : undefined}
      />
      <BoxField label = {config.lobbyButton} />

      <MeterField
        label = {config.selfFovLabel ?? 'self fov'}
        {...config.selfFov}
        onChange = {editable ? (value) => patch({ selfFov: { ...config.selfFov, value } }) : undefined}
      />
      <MeterField
        label = "aspect ratio"
        {...config.aspectRatio}
        onChange = {editable ? (value) => patch({ aspectRatio: { ...config.aspectRatio, value } }) : undefined}
      />
    </div>
  );
}

export function EffectsTab({
  config,
  editable,
  onChange,
}: {
  config   : EffectsConfig;
  editable?: boolean;
  onChange?: (config: EffectsConfig) => void;
}) {
  const patch = (partial: Partial<EffectsConfig>) => {
    if (editable && onChange) onChange({ ...config, ...partial });
  };

  const patchCheck = (index: number, checked: boolean) => {
    patch({
      checks: config.checks.map((item, i) => (i === index ? { ...item, checked } : item)),
    });
  };

  const patchRightItem = (index: number, next: VisualItem) => {
    patch({
      rightItems: config.rightItems.map((item, i) => (i === index ? next : item)),
    });
  };

  return (
    <div           className = "configs-editor-grid grid grid-cols-2 items-center gap-x-10 gap-y-3">
    <SectionHeader label     = "low res" />
    <SectionHeader label     = "high res" />

      <MeterField
        label = "spectrum dist"
        {...config.spectrumDist}
        onChange = {editable ? (value) => patch({ spectrumDist: { ...config.spectrumDist, value } }) : undefined}
      />
      <MeterField
        label = "spectrum power"
        {...config.spectrumPower}
        onChange = {editable ? (value) => patch({ spectrumPower: { ...config.spectrumPower, value } }) : undefined}
      />

      <CheckField
        label    = {config.checks[0].label}
        checked  = {config.checks[0].checked}
        onChange = {editable ? (checked) => patchCheck(0, checked) : undefined}
      />
      <VisualField item = {config.rightItems[0]} onChange = {editable ? (next) => patchRightItem(0, next) : undefined} />

      <CheckField
        label    = {config.checks[1].label}
        checked  = {config.checks[1].checked}
        onChange = {editable ? (checked) => patchCheck(1, checked) : undefined}
      />
      <VisualField item = {config.rightItems[1]} onChange = {editable ? (next) => patchRightItem(1, next) : undefined} />

      <CheckField
        label    = {config.checks[2].label}
        checked  = {config.checks[2].checked}
        onChange = {editable ? (checked) => patchCheck(2, checked) : undefined}
      />
      <div />

      <CheckField
        label    = {config.checks[3].label}
        checked  = {config.checks[3].checked}
        onChange = {editable ? (checked) => patchCheck(3, checked) : undefined}
      />
      <div />

      <MeterField
        label = "global fov"
        {...config.globalFov}
        onChange = {editable ? (value) => patch({ globalFov: { ...config.globalFov, value } }) : undefined}
      />
      <div />
    </div>
  );
}

export function SkinTab({
  config,
  editable,
  onChange,
}: {
  config   : SkinConfig;
  editable?: boolean;
  onChange?: (config: SkinConfig) => void;
}) {
  const patch = (partial: Partial<SkinConfig>) => {
    if (editable && onChange) onChange({ ...config, ...partial });
  };

  return (
    <div      className = "configs-editor-grid grid grid-cols-2 items-center gap-x-10 gap-y-3">
    <BoxField label     = {config.unlockLabel} />
      <div />

      <CheckField
        label    = "collection skin changer"
        checked  = {config.collectionSkinChanger}
        onChange = {editable ? (checked) => patch({ collectionSkinChanger: checked }) : undefined}
      />
      <div />

      <CheckField
        label    = "eject shells"
        checked  = {config.ejectShells}
        onChange = {editable ? (checked) => patch({ ejectShells: checked }) : undefined}
      />
      <CheckField
        label    = "buy binds"
        checked  = {config.buyBinds}
        onChange = {editable ? (checked) => patch({ buyBinds: checked }) : undefined}
      />

      <CheckField
        label    = "buddy"
        checked  = {config.buddyEnabled}
        onChange = {editable ? (checked) => patch({ buddyEnabled: checked }) : undefined}
      />
      <div />

      <MeterField
        label = "buddy"
        {...config.buddyValue}
        onChange = {editable ? (value) => patch({ buddyValue: { ...config.buddyValue, value } }) : undefined}
      />
      <div />

      {editable ? (
        <TextField
          value       = {config.buddyName}
          onChange    = {(value) => patch({ buddyName: value })}
          placeholder = "buddy name"
        />
      ) : (
        <div className = "text-sm font-semibold">
          {config.buddyName}
        </div>
      )}
    </div>
  );
}

export function ThirdpersonTab({
  config,
  editable,
  onChange,
}: {
  config   : ThirdpersonConfig;
  editable?: boolean;
  onChange?: (config: ThirdpersonConfig) => void;
}) {
  const patch = (partial: Partial<ThirdpersonConfig>) => {
    if (editable && onChange) onChange({ ...config, ...partial });
  };

  if (!config.enabled) {
    return (
      <div className = "configs-editor-grid grid grid-cols-2 items-center gap-x-10 gap-y-3">
        <CheckField
          label    = "thirdperson (backspace)"
          checked  = {config.enabled}
          onChange = {editable ? (checked) => patch({ enabled: checked }) : undefined}
        />
      </div>
    );
  }

  return (
    <div className = "configs-editor-grid grid grid-cols-2 items-center gap-x-10 gap-y-3">
      <CheckField
        label    = "thirdperson (backspace)"
        checked  = {config.enabled}
        onChange = {editable ? (checked) => patch({ enabled: checked }) : undefined}
      />
      <div />

      <CheckField
        label    = "big weapons"
        checked  = {config.bigWeapons}
        onChange = {editable ? (checked) => patch({ bigWeapons: checked }) : undefined}
      />
      <CheckField
        label    = "crosshair"
        checked  = {config.crosshair}
        onChange = {editable ? (checked) => patch({ crosshair: checked }) : undefined}
      />

      <CheckField
        label    = "spin"
        checked  = {config.spin}
        onChange = {editable ? (checked) => patch({ spin: checked }) : undefined}
      />
      <CheckField
        label    = "backward"
        checked  = {config.backward}
        onChange = {editable ? (checked) => patch({ backward: checked }) : undefined}
      />

      <CheckField
        label    = "anti aim"
        checked  = {config.antiAim}
        onChange = {editable ? (checked) => patch({ antiAim: checked }) : undefined}
      />
      <ColorField
        label    = "antiaim color"
        color    = {config.antiAimColor}
        onChange = {editable ? (color) => patch({ antiAimColor: color }) : undefined}
      />

      <MeterField
        label = "height"
        {...config.height}
        onChange = {editable ? (value) => patch({ height: { ...config.height, value } }) : undefined}
      />
      <MeterField
        label = "dist"
        {...config.dist}
        onChange = {editable ? (value) => patch({ dist: { ...config.dist, value } }) : undefined}
      />

      <MeterField
        label = "aspect ratio"
        {...config.aspectRatio}
        onChange = {editable ? (value) => patch({ aspectRatio: { ...config.aspectRatio, value } }) : undefined}
      />
      <MeterField
        label = "fov"
        {...config.fov}
        onChange = {editable ? (value) => patch({ fov: { ...config.fov, value } }) : undefined}
      />

      <MeterField
        label = "spin speed"
        {...config.spinSpeed}
        onChange = {editable ? (value) => patch({ spinSpeed: { ...config.spinSpeed, value } }) : undefined}
      />
    </div>
  );
}

