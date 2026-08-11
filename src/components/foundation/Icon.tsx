import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Bookmark,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Ellipsis,
  EllipsisVertical,
  Funnel,
  Heart,
  House,
  Image,
  Info,
  LogOut,
  Menu,
  MessageCircle,
  OctagonAlert,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Star,
  TriangleAlert,
  Trash2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";

import { type IconName, type IconSize } from "../../tokens/icons";

/**
 * Design system name -> lucide React component. Keyed by the same names as
 * `ICON_MAP`, so a missing or extra entry is a type error rather than a
 * blank space at runtime.
 */
const ICON_COMPONENTS: Record<IconName, LucideIcon> = {
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  "arrow-down": ArrowDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  "chevron-down": ChevronDown,
  home: House,
  calendar: Calendar,
  copy: Copy,
  refresh: RefreshCw,
  logout: LogOut,
  close: X,
  menu: Menu,
  search: Search,
  filter: Funnel,
  sort: ArrowUpDown,
  plus: Plus,
  edit: Pencil,
  delete: Trash2,
  bookmark: Bookmark,
  share: Share2,
  "more-horizontal": Ellipsis,
  "more-vertical": EllipsisVertical,
  check: Check,
  info: Info,
  warning: TriangleAlert,
  error: OctagonAlert,
  user: User,
  settings: Settings,
  notification: Bell,
  heart: Heart,
  star: Star,
  comment: MessageCircle,
  image: Image,
};

export interface IconProps {
  /** Design system icon name, not the lucide name. */
  name: IconName;
  /** 16, 20, 24 or 32 — the four sizes drawn in the design file. */
  size?: IconSize;
  className?: string;
  /**
   * Accessible label. Omit for decorative icons, which are hidden from
   * assistive technology.
   */
  label?: string;
}

/**
 * The design system's icon primitive. Colour comes from `currentColor`, so an
 * icon inherits the text colour of whatever it sits in — set it with a
 * semantic utility such as `text-text-muted` on the icon or its parent.
 */
export function Icon({ name, size = 24, className, label }: IconProps) {
  const Component = ICON_COMPONENTS[name];
  return (
    <Component
      width={size}
      height={size}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
    />
  );
}
