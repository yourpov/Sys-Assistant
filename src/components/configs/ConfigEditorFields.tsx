import { useRef, useState } from 'react';

import { AGENT_NAMES }      from '../../constants/agentNames';
import { normalizeHex }     from '../../utils/color';
import { ColorWheelPicker } from '../ColorWheelPicker';
import { Dropdown }         from '../Dropdown';
import { AIM_KEY_DROPDOWN_OPTIONS, AIM_KEY_OPTIONS } from './constants';
import type { AimKey, VisualItem } from './types';

export function NotAvailable() {
  return (
    <div className = "flex h-48 items-center justify-center text-sm font-semibold text-app-faint">
      N/A
    </div>
  );
}

export function meterStep(min: number, max: number): number {
  const span = max - min;
  if (span <= 1) return 0.01;
  if (span <= 10) return 0.1;
  if (span <= 100) return 1;
  return span / 100;
}

export function MeterField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label    : string;
  value    : number;
  min      : number;
  max      : number;
  onChange?: (value: number) => void;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  const step    = meterStep(min, max);

  return (
    <div>
      <div className = "mb-2 text-sm font-semibold lowercase">
        {label}
      </div>
      {onChange ? (
        <input
          type      = "range"
          className = "configs-meter-input"
          min       = {min}
          max       = {max}
          step      = {step}
          value     = {value}
          onChange  = {(e) => onChange(Number(e.target.value))}
        />
      ) : (
        <div className = "h-1.5 w-full rounded-full bg-white/15">
        <div className = "h-full rounded-full bg-white" style = {{ width: `${percent}%` }} />
        </div>
      )}
      <div className = "mt-1 text-center text-sm">
        {value.toFixed(step < 1 ? 1 : 0)}
      </div>
    </div>
  );
}

export function CheckBoxVisual({ checked }: { checked: boolean }) {
  return (
    <span className = {`configs-check-box${checked ? ' checked' : ''}`} aria-hidden = "true">
      {checked && (
        <svg  viewBox = "0 0 24 24" fill        = "none" className    = "h-3 w-3">
        <path d       = "M5 12l5 5L19 7" stroke = "black" strokeWidth = "2.5" strokeLinecap = "round" strokeLinejoin = "round" />
        </svg>
      )}
    </span>
  );
}

export function CheckField({
  label,
  checked,
  onChange,
}: {
  label    : string;
  checked  : boolean;
  onChange?: (checked: boolean) => void;
}) {
  if (onChange) {
    return (
      <label className = "configs-check-field editable">
        <input
          type      = "checkbox"
          className = "configs-check-input"
          checked   = {checked}
          onChange  = {(e) => onChange(e.target.checked)}
        />
        <CheckBoxVisual checked   = {checked} />
        <span           className = "configs-check-label">{label}</span>
      </label>
    );
  }

  return (
    <div            className = "configs-check-field">
    <CheckBoxVisual checked   = {checked} />
    <span           className = "configs-check-label">{label}</span>
    </div>
  );
}

export function ColorField({
  label,
  color,
  onChange,
}: {
  label    : string;
  color    : string;
  onChange?: (color: string) => void;
}) {
  const rootRef                     = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const swatchColor                 = normalizeHex(color);

  if (!onChange) {
    return (
      <div  className = "configs-color-field">
      <div  className = "configs-color-swatch" style = {{ backgroundColor: swatchColor }} />
      <span className = "configs-color-label">{label}</span>
      </div>
    );
  }

  return (
    <div className = "configs-color-field editable-wrap">
      <button
        ref           = {rootRef}
        type          = "button"
        className     = "configs-color-field editable"
        aria-expanded = {pickerOpen}
        aria-haspopup = "dialog"
        onClick       = {() => setPickerOpen((open) => !open)}
      >
        <div  className = "configs-color-swatch" style = {{ backgroundColor: swatchColor }} />
        <span className = "configs-color-label">{label}</span>
      </button>
      {pickerOpen && (
        <ColorWheelPicker
          color     = {swatchColor}
          onChange  = {onChange}
          onClose   = {() => setPickerOpen(false)}
          anchorRef = {rootRef}
        />
      )}
    </div>
  );
}

export function VisualField({ item, onChange }: { item: VisualItem; onChange?: (item: VisualItem) => void }) {
  if ('color' in item) {
    return (
      <ColorField
        label    = {item.label}
        color    = {item.color}
        onChange = {onChange ? (color) => onChange({ label: item.label, color }) : undefined}
      />
    );
  }

  return (
    <CheckField
      label    = {item.label}
      checked  = {item.checked}
      onChange = {onChange ? (checked) => onChange({ label: item.label, checked }) : undefined}
    />
  );
}

export function AimKeyField({
  value,
  sideLabel,
  editable,
  onChange,
}: {
  value     : AimKey | '';
  sideLabel : string;
  editable ?: boolean;
  onChange ?: (key: AimKey) => void;
}) {
  const aimKeyValue = (AIM_KEY_OPTIONS as readonly string[]).includes(value) ? value : '';

  if (editable && onChange) {
    return (
      <>
        <Dropdown
          className   = "configs-aimkey-dropdown"
          value       = {aimKeyValue}
          onChange    = {(key) => onChange(key as AimKey)}
          placeholder = "—"
          options     = {AIM_KEY_DROPDOWN_OPTIONS}
        />
        <SideLabel text = {sideLabel} />
      </>
    );
  }

  return (
    <>
      <KeyBox    label = {aimKeyValue || '—'} />
      <SideLabel text  = {sideLabel} />
    </>
  );
}

export function AgentField({
  agent,
  sideLabel,
  editable,
  onChange,
}: {
  agent     : string;
  sideLabel : string;
  editable ?: boolean;
  onChange ?: (agent: string) => void;
}) {
  const agentValue   = (AGENT_NAMES as readonly string[]).includes(agent) ? agent : '';
  const displayAgent = agent.trim() || 'N/A';

  if (editable && onChange) {
    return (
      <div className = "configs-agent-field">
        <Dropdown
          className   = "configs-agent-dropdown"
          value       = {agentValue}
          onChange    = {onChange}
          placeholder = "Select agent"
          options     = {AGENT_NAMES.map((name) => ({ value: name, label: name }))}
        />
        <SideLabel text = {sideLabel} />
      </div>
    );
  }

  return (
    <div       className = "configs-agent-field">
    <BoxField  label     = {displayAgent} />
    <SideLabel text      = {sideLabel} />
    </div>
  );
}

export function BoxField({ label }: { label: string }) {
  return <div className = "configs-display-button">{label}</div>;
}

export function KeyBox({ label, half }: { label: string; half?: boolean }) {
  return <div className = {`configs-display-button${half ? ' half' : ''}`}>{label}</div>;
}

export function TextField({
  value,
  onChange,
  placeholder,
}: {
  value       : string;
  onChange    : (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type        = "text"
      className   = "configs-key-input w-full text-sm font-semibold"
      value       = {value}
      placeholder = {placeholder}
      onChange    = {(e) => onChange(e.target.value)}
    />
  );
}

export function SideLabel({ text }: { text: string }) {
  return (
    <span className = "text-sm lowercase">
      {text}
    </span>
  );
}

export function SectionHeader({ label }: { label: string }) {
  return <div className = "configs-display-button configs-display-button-header">{label}</div>;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}