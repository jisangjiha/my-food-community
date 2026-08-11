export type SkeletonVariant = "text" | "rect" | "circle";

/**
 * Skeleton — design.pen Skeleton/text, /rect, /circle.
 *
 * Sizes are meant to match whatever is being stood in for, so the values from
 * the design file are only defaults: text 160×14, rect 140×90, circle 56.
 */
export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number;
  /** Circle only: diameter, overriding width/height. */
  size?: number;
  className?: string;
}

const DEFAULTS = {
  text: { width: 160, height: 14, radius: 7 },
  rect: { width: 140, height: 90, radius: 10 },
  circle: { width: 56, height: 56, radius: 9999 },
} satisfies Record<
  SkeletonVariant,
  { width: number; height: number; radius: number }
>;

export function Skeleton({
  variant = "text",
  width,
  height,
  size,
  className,
}: SkeletonProps) {
  const spec = DEFAULTS[variant];
  const resolved =
    variant === "circle" && size
      ? { width: size, height: size }
      : { width: width ?? spec.width, height: height ?? spec.height };

  return (
    <div
      aria-hidden
      className={`bg-border-default ${className ?? ""}`}
      style={{
        width: resolved.width,
        height: resolved.height,
        // text keeps a pill radius at any height; the design uses height/2.
        borderRadius:
          variant === "text"
            ? Number(resolved.height) / 2
            : spec.radius,
      }}
    />
  );
}
