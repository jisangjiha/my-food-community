"use client";

import { useId, type ComponentPropsWithoutRef } from "react";

import { Icon } from "../foundation/Icon";
import type { IconName } from "../../tokens/icons";
import {
  FIELD_BOX_CLASSES,
  FIELD_SIZES,
  FOCUS_RING,
  HELPER_CLASSES,
  LABEL_CLASSES,
  type FieldSize,
} from "./field";

export interface TextFieldProps
  extends Omit<ComponentPropsWithoutRef<"input">, "size" | "type"> {
  /** `password` renders a masked input; both share the same box. */
  type?: "text" | "password";
  size?: FieldSize;
  label?: string;
  /** Replaced by `error` when that is set. */
  helperText?: string;
  error?: string;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  /** Documentation only: pins the focused appearance without real focus. */
  forceFocused?: boolean;
}

export function TextField({
  type = "text",
  size = "md",
  label,
  helperText,
  error,
  leadingIcon,
  trailingIcon,
  forceFocused,
  disabled,
  className,
  id,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const spec = FIELD_SIZES[size];
  const invalid = Boolean(error);
  const message = error ?? helperText;

  return (
    <div
      className={`flex flex-col gap-1.5 ${disabled ? "opacity-50" : ""} ${className ?? ""}`}
    >
      {label && (
        <label
          htmlFor={inputId}
          className={`${LABEL_CLASSES} ${invalid ? "text-text-error" : "text-text-default"}`}
        >
          {label}
        </label>
      )}

      <div
        data-focused={forceFocused || undefined}
        data-invalid={invalid || undefined}
        className={`flex items-center gap-2 ${FIELD_BOX_CLASSES}`}
        style={{
          height: spec.height,
          borderRadius: spec.radius,
          paddingInline: spec.paddingX,
          boxShadow: forceFocused ? FOCUS_RING : undefined,
        }}
      >
        {leadingIcon && (
          <span
            className={invalid ? "text-text-error" : "text-text-subtle"}
            aria-hidden
          >
            <Icon name={leadingIcon} size={spec.icon} />
          </span>
        )}
        <input
          id={inputId}
          type={type}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={message ? messageId : undefined}
          className="type-body-lg min-w-0 flex-1 bg-transparent text-text-default outline-none placeholder:text-text-subtle disabled:cursor-not-allowed"
          {...rest}
        />
        {trailingIcon && (
          <span
            className={invalid ? "text-text-error" : "text-text-subtle"}
            aria-hidden
          >
            <Icon name={trailingIcon} size={spec.icon} />
          </span>
        )}
      </div>

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
