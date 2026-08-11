import type { ComponentPropsWithoutRef } from "react";

import { Icon } from "../foundation/Icon";
import type { IconName } from "../../tokens/icons";

/** design.pen components: Ghost, Circle Brand, Circle Neutral. */
export type IconButtonVariant = "ghost" | "circle-brand" | "circle-neutral";

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost: "text-text-default",
  "circle-brand": "rounded-full bg-background-brand text-text-on-brand",
  "circle-neutral": "rounded-full bg-background-subtle text-text-default",
};

export interface IconButtonProps
  extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  variant?: IconButtonVariant;
  name: IconName;
  /** Required: the button has no visible text to name it. */
  label: string;
  /** Button box in px. The design specifies 48; the icon stays at 24. */
  size?: number;
  iconSize?: 16 | 20 | 24 | 32;
}

export function IconButton({
  variant = "ghost",
  name,
  label,
  size = 48,
  iconSize = 24,
  className,
  disabled,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      disabled={disabled}
      className={[
        "inline-flex shrink-0 items-center justify-center",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand",
        disabled ? "cursor-not-allowed text-text-subtle" : "cursor-pointer",
        disabled ? "" : VARIANT_CLASSES[variant],
        // Keep the circle shape when disabled, drop only the foreground tone.
        disabled && variant !== "ghost" ? "rounded-full bg-background-subtle" : "",
        className ?? "",
      ].join(" ")}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={name} size={iconSize} />
    </button>
  );
}
