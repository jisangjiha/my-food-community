"use client";

import { useId, type ReactNode } from "react";

import { Icon } from "../foundation/Icon";
import {
  FIELD_BOX_CLASSES,
  FIELD_SIZES,
  FOCUS_RING,
  HELPER_CLASSES,
  LABEL_CLASSES,
  type FieldSize,
} from "./field";

export interface SelectProps {
  size?: FieldSize;
  label?: string;
  placeholder?: string;
  /** Rendered as the trigger text; falsy shows the placeholder. */
  value?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  /** Keeps the focused look while the panel is open, per the design guide. */
  open?: boolean;
  /** id of the listbox this trigger controls. Put it on the panel element. */
  listboxId?: string;
  onClick?: () => void;
  className?: string;
  id?: string;
}

export function Select({
  size = "md",
  label,
  placeholder = "선택하세요",
  value,
  helperText,
  error,
  disabled,
  open,
  listboxId,
  onClick,
  className,
  id,
}: SelectProps) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const messageId = `${triggerId}-message`;
  const spec = FIELD_SIZES[size];
  const invalid = Boolean(error);
  const message = error ?? helperText;

  return (
    <div
      className={`flex flex-col gap-1.5 ${disabled ? "opacity-50" : ""} ${className ?? ""}`}
    >
      {label && (
        <label
          htmlFor={triggerId}
          className={`${LABEL_CLASSES} ${invalid ? "text-text-error" : "text-text-default"}`}
        >
          {label}
        </label>
      )}

      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        onClick={onClick}
        // combobox, not plain button: it is the only role that carries
        // aria-expanded/aria-invalid for a value-selecting trigger.
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open ?? false}
        aria-controls={listboxId ?? `${triggerId}-listbox`}
        aria-invalid={invalid || undefined}
        aria-describedby={message ? messageId : undefined}
        data-focused={open || undefined}
        data-invalid={invalid || undefined}
        className={`flex w-full items-center gap-2 text-left ${FIELD_BOX_CLASSES} ${
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        }`}
        style={{
          height: spec.height,
          borderRadius: spec.radius,
          paddingInline: spec.paddingX,
          boxShadow: open ? FOCUS_RING : undefined,
        }}
      >
        <span
          className={`type-body-lg min-w-0 flex-1 truncate ${
            value ? "text-text-default" : "text-text-subtle"
          }`}
        >
          {value || placeholder}
        </span>
        <span className="text-text-subtle" aria-hidden>
          <Icon name="chevron-down" size={spec.icon} />
        </span>
      </button>

      {message && (
        <p
          id={messageId}
          className={`${HELPER_CLASSES} ${invalid ? "text-text-error" : "text-neutral-600"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export interface SelectItemProps {
  size?: FieldSize;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

/** One row of the panel. Its size follows the Select it belongs to. */
export function SelectItem({
  size = "md",
  selected = false,
  disabled = false,
  onClick,
  children,
}: SelectItemProps) {
  const spec = FIELD_SIZES[size];

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={[
        "flex w-full items-center gap-2 rounded-md",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        selected ? "text-text-brand" : "text-text-default",
      ].join(" ")}
      style={{ height: spec.height, paddingInline: spec.paddingX }}
    >
      <span className="type-body-lg min-w-0 flex-1 truncate">{children}</span>
      {selected && <Icon name="check" size={spec.icon} />}
    </div>
  );
}
