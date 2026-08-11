/**
 * Spacing tokens — handed off 1:1 from design.pen `variables`,
 * usage notes from 14-ds-foundation-spacing.txt.
 */

export const spacing = {
  "spacing-8": 8,
  "spacing-12": 12,
  "spacing-16": 16,
  "spacing-20": 20,
  "spacing-24": 24,
  "spacing-32": 32,
} as const;

export type SpacingToken = keyof typeof spacing;

/**
 * `spacing-20` has no documented usage in 14-ds-foundation-spacing.txt —
 * it exists in the design file's variables but the usage list skips it.
 */
export const spacingUsage: Record<SpacingToken, string> = {
  "spacing-8": "칩 나열",
  "spacing-12": "리스트, 카드 갭",
  "spacing-16": "화면 좌우 마진, 카드 갭",
  "spacing-20": "—",
  "spacing-24": "섹션 구분",
  "spacing-32": "큰 섹션 구분, 페이지 상하 여백",
};

export const SPACING_TOKENS = Object.keys(spacing) as SpacingToken[];
