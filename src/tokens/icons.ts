/**
 * Icon registry — handed off from design.pen's icon components.
 *
 * The design system names icons by role (`home`, `close`, `delete`), while
 * lucide names them by shape (`house`, `x`, `trash-2`). Both are recorded so a
 * designer's name and a developer's import stay traceable to each other.
 *
 * 36 icons × 4 sizes = 144 components in the design file.
 */

export const ICON_SIZES = [16, 20, 24, 32] as const;

export type IconSize = (typeof ICON_SIZES)[number];

/** Design system name -> lucide icon name (kebab-case, as in design.pen). */
export const ICON_MAP = {
  "arrow-left": "arrow-left",
  "arrow-right": "arrow-right",
  "arrow-up": "arrow-up",
  "arrow-down": "arrow-down",
  "chevron-left": "chevron-left",
  "chevron-right": "chevron-right",
  "chevron-up": "chevron-up",
  "chevron-down": "chevron-down",
  home: "house",
  calendar: "calendar",
  copy: "copy",
  refresh: "refresh-cw",
  logout: "log-out",
  close: "x",
  menu: "menu",
  search: "search",
  filter: "funnel",
  sort: "arrow-up-down",
  plus: "plus",
  edit: "pencil",
  delete: "trash-2",
  bookmark: "bookmark",
  share: "share-2",
  "more-horizontal": "ellipsis",
  "more-vertical": "ellipsis-vertical",
  check: "check",
  info: "info",
  warning: "triangle-alert",
  error: "octagon-alert",
  user: "user",
  settings: "settings",
  notification: "bell",
  heart: "heart",
  star: "star",
  comment: "message-circle",
  image: "image",
} as const;

export type IconName = keyof typeof ICON_MAP;

export const ICON_NAMES = Object.keys(ICON_MAP) as IconName[];

/** Icons whose design system name differs from the lucide name. */
export const RENAMED_ICONS = ICON_NAMES.filter(
  (name) => ICON_MAP[name] !== name,
);
