"use client";

import { useId, type ComponentPropsWithoutRef } from "react";

import {
  FIELD_BOX_CLASSES,
  FOCUS_RING,
  HELPER_CLASSES,
  LABEL_CLASSES,
} from "./field";

/** design.pen draws the box at 88px — 3 lines of body-lg plus 10px padding. */
const BOX_HEIGHT = 88;

export interface TextAreaProps
  extends Omit<ComponentPropsWithoutRef<"textarea">, "rows"> {
  label?: string;
  helperText?: string;
  error?: string;
  /** Shows a `길이/maxLength` counter under the box on the right. */
  showCounter?: boolean;
  /** Documentation only: pins the focused appearance without real focus. */
  forceFocused?: boolean;
}

export function TextArea({
  label,
  helperText,
  error,
  showCounter = false,
  forceFocused,
  disabled,
  className,
  id,
  value,
  defaultValue,
  maxLength,
  ...rest
}: TextAreaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  const messageId = `${textareaId}-message`;
  const invalid = Boolean(error);
  const message = error ?? helperText;
  const length = String(value ?? defaultValue ?? "").length;

  return (
    <div
      className={`flex flex-col gap-1.5 ${disabled ? "opacity-50" : ""} ${className ?? ""}`}
    >
      {label && (
        <label
          htmlFor={textareaId}
          className={`${LABEL_CLASSES} ${invalid ? "text-text-error" : "text-text-default"}`}
        >
          {label}
        </label>
      )}

      <div
        data-focused={forceFocused || undefined}
        data-invalid={invalid || undefined}
        className={`flex overflow-hidden ${FIELD_BOX_CLASSES}`}
        style={{
          height: BOX_HEIGHT,
          borderRadius: 10,
          padding: "10px 12px",
          boxShadow: forceFocused ? FOCUS_RING : undefined,
        }}
      >
        <textarea
          id={textareaId}
          disabled={disabled}
          value={value}
          defaultValue={defaultValue}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          aria-describedby={message ? messageId : undefined}
          className="type-body-lg w-full resize-none bg-transparent text-text-default outline-none placeholder:text-text-subtle disabled:cursor-not-allowed"
          {...rest}
        />
      </div>

      {(message || showCounter) && (
        <div className="flex items-start justify-between gap-2">
          <p
            id={messageId}
            className={`${HELPER_CLASSES} ${invalid ? "text-text-error" : "text-neutral-600"}`}
          >
            {message}
          </p>
          {showCounter && (
            <span className={`${HELPER_CLASSES} shrink-0 text-neutral-600`}>
              {length}
              {maxLength ? `/${maxLength}` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
