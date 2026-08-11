import type { ReactNode } from "react";

import { MobileTabBar } from "./MobileTabBar";
import { SiteHeader } from "./SiteHeader";

export interface AppShellProps {
  /**
   * Whether the phone tab bar shows. design.pen draws it on 메인 and 마이 but
   * not on 상세 or 등록, which have their own top bar and a full-width action
   * row at the bottom.
   */
  tabBar?: boolean;
  children: ReactNode;
}

/**
 * Page chrome for every screen except 로그인, which is pre-auth and has none.
 *
 * `SiteHeader` is md+ only and `MobileTabBar` is phone only, so exactly one
 * navigation surface is on screen at any width.
 */
export function AppShell({ tabBar = true, children }: AppShellProps) {
  return (
    <>
      <SiteHeader />
      <div
        className={`flex flex-1 flex-col ${
          // Keep the last row clear of the fixed bar — phones only, since the
          // bar is replaced by the header from md.
          tabBar ? "pb-[calc(66px+env(safe-area-inset-bottom))] md:pb-0" : ""
        }`}
      >
        {children}
      </div>
      {tabBar && <MobileTabBar />}
    </>
  );
}
