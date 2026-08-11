import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { typeStyles, type TextVariant } from "../../tokens/typography";

export interface TextProps extends ComponentPropsWithoutRef<"p"> {
  /** One of the 10 type styles from the design system. */
  variant?: TextVariant;
  /** Override the rendered element. Defaults to the variant's semantic tag. */
  as?: ElementType;
  children?: ReactNode;
}

/**
 * The design system's text primitive. Mirrors the 10 reusable text components
 * in design.pen (Display Large … Label Medium).
 *
 * Colour is deliberately not a prop: text inherits `color-text-default` from
 * the page and is overridden with a semantic utility such as `text-text-muted`
 * where a different role is intended.
 */
export function Text({
  variant = "body-md",
  as,
  className,
  children,
  ...rest
}: TextProps) {
  const Component = (as ?? typeStyles[variant].defaultTag) as ElementType;
  return (
    <Component
      className={`type-${variant}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </Component>
  );
}
