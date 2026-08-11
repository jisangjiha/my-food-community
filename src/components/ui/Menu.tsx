import type { ReactNode } from "react";

import { Icon } from "../foundation/Icon";
import type { IconName } from "../../tokens/icons";
import type { FieldSize } from "./field";

/** The design file's menu shadow. */
const MENU_SHADOW = "0 8px 20px #4A305422";

export interface MenuProps {
  children: ReactNode;
  className?: string;
}

/** Menu — design.pen `Menu`. Sizes come from the items it holds. */
export function Menu({ children, className }: MenuProps) {
  return (
    <div
      role="menu"
      className={`flex flex-col gap-0.5 border border-border-default bg-background-surface p-1.5 ${className ?? ""}`}
      style={{ borderRadius: 12, boxShadow: MENU_SHADOW }}
    >
      {children}
    </div>
  );
}

export type MenuItemVariant = "default" | "destructive";

/** md is measured; sm/lg follow the size scale in 13-ds-ui-component-etc.txt. */
const SIZES = {
  sm: { height: 32, icon: 16 as const },
  md: { height: 40, icon: 20 as const },
  lg: { height: 48, icon: 20 as const },
} satisfies Record<FieldSize, { height: number; icon: 16 | 20 }>;

export interface MenuItemProps {
  variant?: MenuItemVariant;
  size?: FieldSize;
  icon?: IconName;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function MenuItem({
  variant = "default",
  size = "md",
  icon,
  disabled,
  onClick,
  children,
}: MenuItemProps) {
  const spec = SIZES[size];
  const destructive = variant === "destructive";

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2.5 rounded-lg px-3 text-left",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-brand",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
      style={{ height: spec.height }}
    >
      {icon && (
        <span className={destructive ? "text-text-error" : "text-text-muted"}>
          <Icon name={icon} size={spec.icon} />
        </span>
      )}
      <span
        className={`type-body-lg min-w-0 flex-1 truncate ${
          destructive ? "text-text-error" : "text-text-default"
        }`}
      >
        {children}
      </span>
    </button>
  );
}
