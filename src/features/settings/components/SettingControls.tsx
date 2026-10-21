import { useId, type ReactNode } from "react";
import type { TFn } from "../types";

/** A single settings row: label + description + a control on the right. */
export function SettingRow({
  t,
  label,
  descKey,
  children,
}: {
  t: TFn;
  label: string;
  descKey: string;
  children: ReactNode;
}) {
  const descId = useId();
  return (
    <div className="odon-settings-row">
      <div className="odon-settings-row-text">
        <div className="odon-settings-row-label">{label}</div>
        <div className="odon-settings-row-desc" id={descId}>
          {t(descKey)}
        </div>
      </div>
      <div className="odon-settings-row-control" data-desc={descId}>
        {children}
      </div>
    </div>
  );
}

/** A labelled <select> control bound to a string-enum setting. */
export function SelectRow<V extends string>({
  t,
  label,
  descKey,
  value,
  options,
  onChange,
  disabled = false,
}: {
  t: TFn;
  label: string;
  descKey: string;
  value: V;
  options: { value: V; labelKey: string }[];
  onChange: (value: V) => void;
  disabled?: boolean;
}) {
  return (
    <SettingRow t={t} label={label} descKey={descKey}>
      <select
        className="odon-settings-select"
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as V)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.labelKey)}
          </option>
        ))}
      </select>
    </SettingRow>
  );
}

/** A labelled on/off switch (accessible checkbox). */
export function ToggleRow({
  t,
  label,
  descKey,
  checked,
  onChange,
  disabled = false,
}: {
  t: TFn;
  label: string;
  descKey: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SettingRow t={t} label={label} descKey={descKey}>
      <label className="odon-settings-switch">
        <input
          type="checkbox"
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="odon-settings-switch-track" aria-hidden="true" />
      </label>
    </SettingRow>
  );
}

/** A labelled free-text (or typed) input control bound to a string setting. */
export function InputRow({
  t,
  label,
  descKey,
  value,
  type = "text",
  disabled,
  onChange,
}: {
  t: TFn;
  label: string;
  descKey: string;
  value: string;
  type?: "text" | "date" | "color";
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <SettingRow t={t} label={label} descKey={descKey}>
      <input
        className="odon-settings-input"
        type={type}
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </SettingRow>
  );
}

/** A labelled multi-line text area bound to a string setting. */
export function TextAreaRow({
  t,
  label,
  descKey,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  t: TFn;
  label: string;
  descKey: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <SettingRow t={t} label={label} descKey={descKey}>
      <textarea
        className="odon-settings-textarea"
        aria-label={label}
        rows={3}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </SettingRow>
  );
}
