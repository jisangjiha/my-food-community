"use client";

import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

import type { ToggleSize } from "./Checkbox";

/** Ring geometry measured from design.pen. */
const SIZES = {
  sm: { ring: 16, dot: 8 },
  md: { ring: 20, dot: 10 },
} satisfies Record<ToggleSize, { ring: number; dot: number }>;

export interface RadioProps
  extends Omit<
    ComponentPropsWithoutRef<"input">,
    "type" | "size" | "checked" | "defaultChecked"
  > {
  size?: ToggleSize;
  checked?: boolean;
  children?: ReactNode;
}

/**
 * A radio is never used alone — always inside a `RadioGroup`
 * (10-ds-ui-component-form.txt: "단독 사용 금지").
 */
export function Radio({
  size = "md",
  checked = false,
  disabled,
  className,
  id,
  children,
  ...rest
}: RadioProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const spec = SIZES[size];

  return (
    <div
      className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""} ${className ?? ""}`}
    >
      <span className="relative inline-flex shrink-0">
        <input
          id={inputId}
          type="radio"
          checked={checked}
          disabled={disabled}
          className="peer absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          style={{ width: spec.ring, height: spec.ring }}
          readOnly
          {...rest}
        />
        <span
          aria-hidden
          className={[
            "inline-flex items-center justify-center rounded-full border-2 bg-background-surface",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-border-brand",
            checked ? "border-border-brand" : "border-border-strong",
          ].join(" ")}
          style={{ width: spec.ring, height: spec.ring }}
        >
          {checked && (
            <span
              className="rounded-full bg-background-brand"
              style={{ width: spec.dot, height: spec.dot }}
            />
          )}
        </span>
      </span>
      {children && (
        <label htmlFor={inputId} className="type-body-md text-text-default">
          {children}
        </label>
      )}
    </div>
  );
}

export interface RadioGroupProps {
  /** Names the group for assistive technology. */
  label: string;
  name: string;
  value?: string;
  options: { value: string; label: ReactNode; disabled?: boolean }[];
  size?: ToggleSize;
  onValueChange?: (value: string) => void;
}

export function RadioGroup({
  label,
  name,
  value,
  options,
  size = "md",
  onValueChange,
}: RadioGroupProps) {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="type-label-lg mb-1 text-text-default">{label}</legend>
      {options.map((option) => (
        <Radio
          key={option.value}
          name={name}
          size={size}
          value={option.value}
          checked={value === option.value}
          disabled={option.disabled}
          onChange={() => onValueChange?.(option.value)}
        >
          {option.label}
        </Radio>
      ))}
    </fieldset>
  );
}
