import type { ElementType, ReactNode } from "react";

/**
 * The one place the page width rule lives.
 *
 * design.pen only draws a 360px phone. The agreed expansion is: grow with the
 * viewport up to 1280, then stop and let the surplus become left/right margin.
 * The horizontal padding steps with the breakpoints so the content never
 * touches the edge — 16 on phones (`spacing-16`, the design's screen margin),
 * 24 from md, 32 from lg.
 *
 * Note on the class names: `globals.css` defines `--spacing-8 … --spacing-32`
 * as the design's spacing tokens, which *shadows* Tailwind's 0.25rem scale for
 * exactly those numbers. So `px-32` is the 32px token, not 8rem, and `px-4`
 * (16px) still comes from the default scale. Any length that is not a spacing
 * token is written as an arbitrary value to keep that distinction obvious.
 */

/** Content caps narrower than the 1280 grid, for reading- and form-width pages. */
export const WIDTHS = {
  /** Feeds and grids — the full 1280. */
  grid: "max-w-[1280px]",
  /** Detail reading column. */
  article: "max-w-[800px]",
  /** Forms: long input lines hurt scanning. */
  form: "max-w-[640px]",
} as const;

export type ContainerWidth = keyof typeof WIDTHS;

export interface PageContainerProps {
  width?: ContainerWidth;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

export function PageContainer({
  width = "grid",
  as,
  className,
  children,
}: PageContainerProps) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      className={`mx-auto w-full ${WIDTHS[width]} px-4 md:px-24 lg:px-32 ${className ?? ""}`}
    >
      {children}
    </Component>
  );
}
