import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Icon } from "../foundation/Icon";
import type { IconName } from "../../tokens/icons";

export type ChipSize = "sm" | "md";

/**
 * md is measured from design.pen; sm follows the padding rule in
 * 10-ds-ui-component-form.txt. Horizontal padding tightens when a leading
 * icon is present.
 */
const SIZES = {
  sm: { height: 24, radius: 12, paddingX: 12, paddingXWithIcon: 6 },
  md: { height: 32, radius: 16, paddingX: 16, paddingXWithIcon: 8 },
} satisfies Record<
  ChipSize,
  { height: number; radius: number; paddingX: number; paddingXWithIcon: number }
>;

/** The guide fixes the chip glyph at 16px regardless of chip size. */
const ICON_SIZE = 16;

export interface ChipProps
  extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  size?: ChipSize;
  selected?: boolean;
  leadingIcon?: IconName;
  children?: ReactNode;
}

export function Chip({
  size = "md",
  selected = false,
  leadingIcon,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ChipProps) {
  const spec = SIZES[size];

  return (
    <button
      type={type}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        "inline-flex shrink-0 items-center justify-center gap-1 type-label-lg",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        selected
          ? "bg-background-brand text-text-on-brand"
          : "border border-border-strong bg-background-surface text-text-default",
        className ?? "",
      ].join(" ")}
      style={{
        height: spec.height,
        borderRadius: spec.radius,
        paddingInline: leadingIcon ? spec.paddingXWithIcon : spec.paddingX,
      }}
      {...rest}
    >
      {leadingIcon && <Icon name={leadingIcon} size={ICON_SIZE} />}
      {children}
    </button>
  );
}
