/**
 * Typography tokens — handed off 1:1 from design.pen `variables`,
 * with the 10 type styles from 06-ds-foundation-typography.txt.
 *
 * Each variant maps to a `.type-<variant>` class defined in globals.css,
 * which is composed purely from the token custom properties below.
 */

export const fontFamily = "Pretendard Variable";

export const fontSize = {
  "font-size-100": 12,
  "font-size-200": 14,
  "font-size-300": 16,
  "font-size-400": 20,
  "font-size-500": 24,
  "font-size-600": 28,
  "font-size-700": 32,
  "font-size-800": 36,
  "font-size-900": 40,
} as const;

export const fontWeight = {
  "font-weight-regular": "400",
  "font-weight-semibold": "600",
  "font-weight-bold": "700",
} as const;

export const lineHeight = {
  "font-line-height-tight": 1.2,
  "font-line-height-normal": 1.4,
} as const;

/** Common tracking shared by every type style: -2%. */
export const letterSpacing = "-0.02em";

export type TextVariant =
  | "display-lg"
  | "display-md"
  | "display-sm"
  | "heading-lg"
  | "heading-md"
  | "heading-sm"
  | "body-lg"
  | "body-md"
  | "label-lg"
  | "label-md";

export interface TypeStyle {
  /** Name of the matching reusable component in design.pen. */
  designName: string;
  sizeToken: keyof typeof fontSize;
  weightToken: keyof typeof fontWeight;
  lineHeightToken: keyof typeof lineHeight;
  /** Default HTML element the Text component renders for this variant. */
  defaultTag: "h1" | "h2" | "h3" | "h4" | "h5" | "p" | "span";
}

export const typeStyles: Record<TextVariant, TypeStyle> = {
  "display-lg": {
    designName: "Display Large",
    sizeToken: "font-size-800",
    weightToken: "font-weight-bold",
    lineHeightToken: "font-line-height-tight",
    defaultTag: "h1",
  },
  "display-md": {
    designName: "Display Medium",
    sizeToken: "font-size-700",
    weightToken: "font-weight-bold",
    lineHeightToken: "font-line-height-tight",
    defaultTag: "h1",
  },
  "display-sm": {
    designName: "Display Small",
    sizeToken: "font-size-600",
    weightToken: "font-weight-bold",
    lineHeightToken: "font-line-height-tight",
    defaultTag: "h2",
  },
  "heading-lg": {
    designName: "Heading Large",
    sizeToken: "font-size-500",
    weightToken: "font-weight-bold",
    lineHeightToken: "font-line-height-tight",
    defaultTag: "h3",
  },
  "heading-md": {
    designName: "Heading Medium",
    sizeToken: "font-size-400",
    weightToken: "font-weight-bold",
    lineHeightToken: "font-line-height-tight",
    defaultTag: "h4",
  },
  "heading-sm": {
    designName: "Heading Small",
    sizeToken: "font-size-300",
    weightToken: "font-weight-semibold",
    lineHeightToken: "font-line-height-tight",
    defaultTag: "h5",
  },
  "body-lg": {
    designName: "Body Large",
    sizeToken: "font-size-300",
    weightToken: "font-weight-regular",
    lineHeightToken: "font-line-height-normal",
    defaultTag: "p",
  },
  "body-md": {
    designName: "Body Medium",
    sizeToken: "font-size-200",
    weightToken: "font-weight-regular",
    lineHeightToken: "font-line-height-normal",
    defaultTag: "p",
  },
  "label-lg": {
    designName: "Label Large",
    sizeToken: "font-size-200",
    weightToken: "font-weight-semibold",
    lineHeightToken: "font-line-height-normal",
    defaultTag: "span",
  },
  "label-md": {
    designName: "Label Medium",
    sizeToken: "font-size-100",
    weightToken: "font-weight-regular",
    lineHeightToken: "font-line-height-normal",
    defaultTag: "span",
  },
};

export const TEXT_VARIANTS = Object.keys(typeStyles) as TextVariant[];
