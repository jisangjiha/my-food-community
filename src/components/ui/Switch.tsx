"use client";

import { useId, type ReactNode } from "react";

import type { ToggleSize } from "./Checkbox";

/** Track and knob geometry measured from design.pen. */
const SIZES = {
  sm: { width: 32, height: 16, radius: 8, knob: 12, padding: 2 },
  md: { width: 40, height: 20, radius: 10, knob: 16, padding: 2 },
} satisfies Record<
  ToggleSize,
  { width: number; height: number; radius: number; knob: number; padding: number }
>;

/** The knob's drop shadow, taken from the design file. */
const KNOB_SHADOW = "0 1px 2px #00000026";

export interface SwitchProps {
  size?: ToggleSize;
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  id?: string;
  children?: ReactNode;
}

export function Switch({
  size = "md",
  checked = false,
  disabled,
  onCheckedChange,
  className,
  id,
  children,
}: SwitchProps) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const spec = SIZES[size];

  return (
    <div
      className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""} ${className ?? ""}`}
    >
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={[
          "inline-flex shrink-0 items-center",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
          checked ? "justify-end bg-background-brand" : "bg-border-strong",
        ].join(" ")}
        style={{
          width: spec.width,
          height: spec.height,
          borderRadius: spec.radius,
          padding: spec.padding,
        }}
      >
        <span
          className="rounded-full bg-background-surface"
          style={{
            width: spec.knob,
            height: spec.knob,
            boxShadow: KNOB_SHADOW,
          }}
        />
      </button>
      {children && (
        <label htmlFor={switchId} className="type-body-md text-text-default">
          {children}
        </label>
      )}
    </div>
  );
}
