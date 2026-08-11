/**
 * Spinner — design.pen `Spinner`.
 *
 * The design draws it as a ring arc: 24px, innerRadius 0.72, sweep 280°.
 * Those three numbers are reproduced exactly below, so the ring thickness and
 * gap stay right at any size.
 */

const INNER_RADIUS_RATIO = 0.72;
const SWEEP_DEGREES = 280;

export interface SpinnerProps {
  /** Diameter in px. The design specifies 24 (md). */
  size?: number;
  /** Colour comes from `currentColor`; set it on this element or a parent. */
  className?: string;
  /** Announced to assistive technology. Pass null for a purely decorative spinner. */
  label?: string | null;
}

export function Spinner({
  size = 24,
  className,
  label = "로딩 중",
}: SpinnerProps) {
  const outerRadius = size / 2;
  const strokeWidth = outerRadius * (1 - INNER_RADIUS_RATIO);
  // Stroke straddles the path, so the path sits midway through the ring.
  const radius = outerRadius - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * (SWEEP_DEGREES / 360);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`animate-spin ${className ?? ""}`}
      role={label ? "status" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <circle
        cx={outerRadius}
        cy={outerRadius}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${arc} ${circumference - arc}`}
      />
    </svg>
  );
}
