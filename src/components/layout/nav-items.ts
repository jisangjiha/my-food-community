import type { IconName } from "../../tokens/icons";

/**
 * The four destinations in design.pen's bottom bar, shared by the phone tab bar
 * and the md+ header so the two can never list different things.
 *
 * `맛지도` is drawn in the design but has no screen in this handoff, so it has
 * no href and renders as a non-navigating item rather than a dead link.
 */
export interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  href?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "홈", icon: "home", href: "/" },
  { key: "map", label: "맛지도", icon: "search" },
  { key: "register", label: "등록", icon: "edit", href: "/register" },
  { key: "my", label: "MY", icon: "user", href: "/my" },
];

/**
 * Which nav item a pathname belongs to. `/restaurants/…`와 `/meetings/…`는 홈에서
 * 들어가는 화면이라 홈 밑이다. 결제 완료는 흐름의 끝이고 이어지는 곳이 마이
 * 페이지의 결제 내역이라 MY 밑에 둔다.
 */
export function activeKey(pathname: string): string | null {
  if (
    pathname === "/" ||
    pathname.startsWith("/restaurants") ||
    pathname.startsWith("/meetings")
  ) {
    return "home";
  }
  if (pathname.startsWith("/register")) return "register";
  if (pathname.startsWith("/my") || pathname.startsWith("/payments")) {
    return "my";
  }
  return null;
}
