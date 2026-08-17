import type { ReactNode } from "react";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "error"
  | "info"
  | "warning";
export type BadgeSize = "md" | "lg";
/** 외곽선형은 design.pen `Badge`, 채움형은 결제·취소 내역의 상태 칩이다. */
export type BadgeTone = "outline" | "soft";

/** 외곽선 + 라벨 색. design.pen `Badge`. */
const OUTLINE: Record<BadgeVariant, string> = {
  neutral: "border-border-strong bg-background-surface text-text-default",
  brand: "border-border-brand bg-background-surface text-text-brand",
  success: "border-border-success bg-background-surface text-text-success",
  error: "border-border-error bg-background-surface text-text-error",
  info: "border-border-info bg-background-surface text-text-info",
  warning: "border-border-warning bg-background-surface text-text-warning",
};

/**
 * 채움 + 라벨 색. 테두리는 없다.
 *
 * `brand`는 design.pen의 Badge 세트에는 없지만 결제 내역의 `참여 예정` 칩이 이
 * 조합(brand-subtle + text-brand)이다. 외곽선형도 같은 규칙으로 함께 채워 둔다.
 */
const SOFT: Record<BadgeVariant, string> = {
  neutral: "border-transparent bg-background-subtle text-text-muted",
  brand: "border-transparent bg-background-brand-subtle text-text-brand",
  success: "border-transparent bg-background-success text-text-success",
  error: "border-transparent bg-background-error text-text-error",
  info: "border-transparent bg-background-info text-text-info",
  warning: "border-transparent bg-background-warning text-text-warning",
};

/** md는 실측, lg는 13-ds-ui-component-etc.txt(24 높이, 8 패딩). */
const SIZES = {
  md: { height: 20, radius: 10, paddingX: 8 },
  lg: { height: 24, radius: 12, paddingX: 8 },
} satisfies Record<BadgeSize, { height: number; radius: number; paddingX: number }>;

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({
  variant = "neutral",
  size = "md",
  tone = "outline",
  children,
  className,
}: BadgeProps) {
  const spec = SIZES[size];
  const colours = tone === "soft" ? SOFT[variant] : OUTLINE[variant];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border type-label-md ${colours} ${className ?? ""}`}
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
