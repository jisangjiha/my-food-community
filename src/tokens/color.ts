/**
 * Color tokens — handed off 1:1 from design.pen `variables`.
 *
 * Primitives hold literal hex values. Semantic tokens never hold hex; they
 * reference a primitive by name, exactly as the design file does.
 */

export const PALETTE_NAMES = [
  "brand",
  "neutral",
  "amber",
  "green",
  "blue",
  "rose",
] as const;

export type PaletteName = (typeof PALETTE_NAMES)[number];

export const PALETTE_STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;

export type PaletteStep = (typeof PALETTE_STEPS)[number];

/** What each palette is for, per 05-ds-foundation-color.txt. */
export const PALETTE_ROLES: Record<PaletteName, string> = {
  brand: "브랜드",
  neutral: "뉴트럴",
  amber: "경고 (warning)",
  green: "성공 (success)",
  blue: "정보 (info)",
  rose: "에러 (error)",
};

export const primitives: Record<PaletteName, Record<PaletteStep, string>> = {
  brand: {
    50: "#FAF5FB",
    100: "#F4E9F5",
    200: "#E9D4E9",
    300: "#D5AFD4",
    400: "#BC85BA",
    500: "#A263A0",
    600: "#8B4E89",
    700: "#713F6F",
    800: "#5D355B",
    900: "#4D2E4B",
    950: "#301C2F",
  },
  neutral: {
    50: "#FAFAFB",
    100: "#F3F1F5",
    200: "#E7E3EB",
    300: "#D2CCD8",
    400: "#A89FB0",
    500: "#837989",
    600: "#665D6C",
    700: "#524A57",
    800: "#3B353F",
    900: "#241F27",
    950: "#171319",
  },
  amber: {
    50: "#FEF9EC",
    100: "#FCEFC9",
    200: "#F9DE8F",
    300: "#F5C74E",
    400: "#F1B01F",
    500: "#D9930E",
    600: "#B87209",
    700: "#93520C",
    800: "#7A4211",
    900: "#683812",
    950: "#3C1D05",
  },
  green: {
    50: "#ECFBF3",
    100: "#D1F5E1",
    200: "#A6EBC7",
    300: "#6DDAA6",
    400: "#42B883",
    500: "#23A06C",
    600: "#178055",
    700: "#156646",
    800: "#14513A",
    900: "#114331",
    950: "#07261B",
  },
  blue: {
    50: "#EEF5FF",
    100: "#D9E8FF",
    200: "#BCD7FF",
    300: "#8EBBFF",
    400: "#5A97FB",
    500: "#3B75F0",
    600: "#2A5AD6",
    700: "#2447AD",
    800: "#243E88",
    900: "#23386B",
    950: "#182242",
  },
  rose: {
    50: "#FEF2F4",
    100: "#FCE1E6",
    200: "#F9C6D0",
    300: "#F49CAD",
    400: "#EC6684",
    500: "#D94A68",
    600: "#BE3251",
    700: "#9E2643",
    800: "#84223C",
    900: "#702038",
    950: "#3E0E1B",
  },
};

/** Semantic token -> primitive token name (never a raw hex). */
export const semantics = {
  text: {
    "color-text-default": "color-neutral-900",
    "color-text-muted": "color-neutral-500",
    "color-text-subtle": "color-neutral-400",
    "color-text-brand": "color-brand-600",
    "color-text-brand-strong": "color-brand-700",
    "color-text-on-brand": "color-neutral-50",
    "color-text-success": "color-green-700",
    "color-text-warning": "color-amber-700",
    "color-text-error": "color-rose-600",
    "color-text-info": "color-blue-700",
  },
  background: {
    "color-background-default": "color-neutral-50",
    "color-background-surface": "color-neutral-50",
    "color-background-subtle": "color-neutral-100",
    "color-background-canvas": "color-brand-50",
    "color-background-brand": "color-brand-600",
    "color-background-brand-strong": "color-brand-700",
    "color-background-brand-muted": "color-brand-200",
    "color-background-brand-subtle": "color-brand-100",
    "color-background-disabled": "color-brand-300",
    "color-background-overlay": "color-neutral-950",
    "color-background-success": "color-green-50",
    "color-background-warning": "color-amber-50",
    "color-background-error": "color-rose-50",
    "color-background-info": "color-blue-50",
  },
  border: {
    "color-border-default": "color-neutral-200",
    "color-border-strong": "color-neutral-300",
    "color-border-brand": "color-brand-500",
    "color-border-success": "color-green-500",
    "color-border-warning": "color-amber-500",
    "color-border-error": "color-rose-500",
    "color-border-error-subtle": "color-rose-200",
    "color-border-info": "color-blue-500",
  },
  other: {
    "color-star": "color-amber-400",
  },
} as const;

export type SemanticGroup = keyof typeof semantics;

/** Resolve a primitive token name such as `color-brand-600` to its hex value. */
export function resolvePrimitive(tokenName: string): string {
  const match = /^color-([a-z]+)-(\d+)$/.exec(tokenName);
  if (!match) throw new Error(`Not a primitive color token: ${tokenName}`);
  const [, palette, step] = match;
  const scale = primitives[palette as PaletteName];
  if (!scale) throw new Error(`Unknown palette: ${palette}`);
  const hex = scale[Number(step) as PaletteStep];
  if (!hex) throw new Error(`Unknown step: ${tokenName}`);
  return hex;
}
