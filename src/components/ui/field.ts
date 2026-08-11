/**
 * Shared field geometry and state styling for TextField / TextArea / Select.
 *
 * Only `md` is drawn in design.pen. The `sm` and `lg` rows are required by
 * 10-ds-ui-component-form.txt but were never realised in the design file, so
 * their radius follows the Button scale (8 / 10 / 12) and their padding steps
 * by 2px around the measured md value. Marked below so it is obvious which
 * numbers came from the design and which were inferred.
 */

export type FieldSize = "sm" | "md" | "lg";

/** Field state. `focused` is a real interaction state, not a prop. */
export type FieldState = "default" | "focused" | "disabled" | "error";

export const FIELD_SIZES = {
  sm: { height: 32, radius: 8, paddingX: 10, icon: 16 as const, measured: false },
  md: { height: 40, radius: 10, paddingX: 12, icon: 20 as const, measured: true },
  lg: { height: 48, radius: 12, paddingX: 14, icon: 20 as const, measured: false },
} satisfies Record<
  FieldSize,
  {
    height: number;
    radius: number;
    paddingX: number;
    icon: 16 | 20;
    measured: boolean;
  }
>;

/** brand-500 at 25% alpha, spread 3 — the focus ring drawn in design.pen. */
export const FOCUS_RING = "0 0 0 3px #A263A340";

/**
 * Border and ring per state. `data-focused` lets a story pin the focused look;
 * real usage gets it from `:focus-within`.
 */
export const FIELD_BOX_CLASSES = [
  "bg-background-surface",
  "border border-border-strong",
  "focus-within:border-[1.5px] focus-within:border-border-brand",
  "data-[focused=true]:border-[1.5px] data-[focused=true]:border-border-brand",
  "data-[invalid=true]:border-[1.5px] data-[invalid=true]:border-border-error",
].join(" ");

export const HELPER_CLASSES = "type-label-md";
export const LABEL_CLASSES = "type-label-lg";
