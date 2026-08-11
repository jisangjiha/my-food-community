import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Icon } from "../foundation/Icon";
import { Spinner } from "./Spinner";
import type { IconName } from "../../tokens/icons";

export type ButtonVariant = "primary" | "secondary" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Measured from design.pen's Buttons frame. Corner radius is not tokenised in
 * the design file — these are the literal values it uses per size.
 */
export const BUTTON_SIZES = {
  sm: { height: 32, radius: 8, paddingX: 12, gap: 6, icon: 16 as const },
  md: { height: 40, radius: 10, paddingX: 16, gap: 8, icon: 20 as const },
  lg: { height: 48, radius: 12, paddingX: 20, gap: 8, icon: 20 as const },
} satisfies Record<
  ButtonSize,
  { height: number; radius: number; paddingX: number; gap: number; icon: 16 | 20 }
>;

/** Semantic tokens per variant, taken from the design components. */
export const VARIANT_CLASSES: Record<
  ButtonVariant,
  { enabled: string; disabled: string }
> = {
  primary: {
    enabled: "bg-background-brand text-text-on-brand",
    disabled: "bg-background-disabled text-text-subtle",
  },
  secondary: {
    enabled:
      "bg-background-surface text-text-default border border-border-strong",
    disabled:
      "bg-background-surface text-text-subtle border border-border-default",
  },
  destructive: {
    enabled:
      "bg-background-surface text-text-error border border-border-error",
    disabled:
      "bg-background-surface text-text-subtle border border-border-default",
  },
};

/**
 * The class list and box a button-shaped control needs, so `Button` and
 * `ButtonLink` cannot drift apart.
 */
export function buttonAppearance(
  variant: ButtonVariant,
  size: ButtonSize,
  { disabled = false, className }: { disabled?: boolean; className?: string } = {},
) {
  const spec = BUTTON_SIZES[size];
  return {
    className: [
      "inline-flex shrink-0 items-center justify-center type-label-lg",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand",
      disabled ? "cursor-not-allowed" : "cursor-pointer",
      VARIANT_CLASSES[variant][disabled ? "disabled" : "enabled"],
      className ?? "",
    ].join(" "),
    style: {
      height: spec.height,
      borderRadius: spec.radius,
      paddingInline: spec.paddingX,
      gap: spec.gap,
    },
    iconSize: spec.icon,
  };
}

export interface ButtonProps
  extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Replaces the leading icon with a spinner and blocks interaction, keeping
   * the label. design.pen draws a static `refresh-cw` glyph to stand in for it.
   */
  loading?: boolean;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const look = buttonAppearance(variant, size, { disabled, className });

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={look.className}
      style={look.style}
      {...rest}
    >
      {loading ? (
        <Spinner size={look.iconSize} label={null} />
      ) : (
        leadingIcon && <Icon name={leadingIcon} size={look.iconSize} />
      )}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size={look.iconSize} />}
    </button>
  );
}
