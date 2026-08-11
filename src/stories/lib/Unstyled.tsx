import type { ReactNode } from "react";

/**
 * Storybook's docs stylesheet is unlayered, so it beats every Tailwind
 * utility — which all live in `@layer utilities` — no matter how specific.
 * `sb-unstyled` is Storybook's opt-out: inside it the docs typography reset
 * stops matching and our own classes take effect.
 *
 * Every component embedded in an `.mdx` docs page must be wrapped in this.
 */
export function Unstyled({ children }: { children: ReactNode }) {
  return <div className="sb-unstyled">{children}</div>;
}
