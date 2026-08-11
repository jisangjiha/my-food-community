import type { ReactNode } from "react";

export type BadgeVariant =
  | "neutral"
  | "success"
  | "error"
  | "info"
  | "warning";
export type BadgeSize = "md" | "lg";

/** Border and label colour per variant, from design.pen. */
const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "border-border-strong text-text-default",
  success: "border-border-success text-text-success",
  error: "border-border-error text-text-error",
  info: "border-border-info text-text-info",
  warning: "border-border-warning text-text-warning",
};

/** md is measured; lg follows 13-ds-ui-component-etc.txt (24 high, 8 padding). */
const SIZES = {
  md: { height: 20, radius: 10, paddingX: 8 },
  lg: { height: 24, radius: 12, paddingX: 8 },
} satisfies Record<BadgeSize, { height: number; radius: number; paddingX: number }>;

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}

export function Badge({
  variant = "neutral",
  size = "md",
  children,
  className,
}: BadgeProps) {
  const spec = SIZES[size];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border bg-background-surface type-label-md ${VARIANTS[variant]} ${className ?? ""}`}
      style={{
        height: spec.height,
        borderRadius: spec.radius,
        paddingInline: spec.paddingX,
      }}
    >
      {children}
    </span>
  );
}
