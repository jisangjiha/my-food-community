"use client";

import {
  useEffect,
  useId,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

export type ToggleSize = "sm" | "md";

/** Box geometry measured from design.pen. */
const SIZES = {
  sm: { box: 16, radius: 5, glyph: 10, bar: 10 },
  md: { box: 20, radius: 6, glyph: 12, bar: 12 },
} satisfies Record<
  ToggleSize,
  { box: number; radius: number; glyph: number; bar: number }
>;

export interface CheckboxProps
  extends Omit<
    ComponentPropsWithoutRef<"input">,
    "type" | "size" | "checked" | "defaultChecked"
  > {
  size?: ToggleSize;
  checked?: boolean;
  /** Third selection state; renders a bar instead of a tick. */
  indeterminate?: boolean;
  /** Red border. Group errors belong under the whole form, shown once. */
  invalid?: boolean;
  children?: ReactNode;
}

export function Checkbox({
  size = "md",
  checked = false,
  indeterminate = false,
  invalid = false,
  disabled,
  className,
  id,
  children,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const spec = SIZES[size];
  const filled = checked || indeterminate;
  const inputRef = useRef<HTMLInputElement>(null);

  // A native checkbox carries the mixed state on the DOM property, not on
  // aria-checked — setting aria-checked="mixed" here is invalid ARIA.
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <div
      className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""} ${className ?? ""}`}
    >
      <span className="relative inline-flex shrink-0">
        <input
          ref={inputRef}
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className="peer absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          style={{ width: spec.box, height: spec.box }}
          readOnly
          {...rest}
        />
        <span
          aria-hidden
          className={[
            "inline-flex items-center justify-center",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-border-brand",
            filled
              ? "bg-background-brand text-text-on-brand"
              : "bg-background-surface",
            filled
              ? ""
              : invalid
                ? "border-2 border-border-error"
                : "border-2 border-border-strong",
          ].join(" ")}
          style={{
            width: spec.box,
            height: spec.box,
            borderRadius: spec.radius,
          }}
        >
          {indeterminate ? (
            <span
              className="rounded-[1px] bg-current"
              style={{ width: spec.bar, height: 2 }}
            />
          ) : (
            checked && (
              <svg
                width={spec.glyph}
                height={spec.glyph}
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M2.5 6.2 4.8 8.5 9.5 3.8"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
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
