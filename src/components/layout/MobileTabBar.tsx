"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "../foundation/Icon";
import { PageContainer } from "./PageContainer";
import { NAV_ITEMS, activeKey } from "./nav-items";

/**
 * design.pen's `Bottom Fixed Navigation`, phone only.
 *
 * The design positions the five slots absolutely inside a 360px frame; here
 * they are distributed with flex so the bar survives every phone width. The
 * home-indicator pill in the design file is OS chrome, not app UI, so it is
 * dropped. From md the header takes over — see `SiteHeader`.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const active = activeKey(pathname);

  return (
    <nav
      // Distinct from the header's nav so the two never present as the same
      // landmark to assistive technology.
      aria-label="하단 탭 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-background-surface md:hidden"
      style={{
        boxShadow: "0 -3px 12px #4A30540F",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <PageContainer className="flex items-center justify-between py-[10px]">
        {NAV_ITEMS.map((item) => {
          const selected = item.key === active;
          const tone = selected ? "text-text-brand" : "text-text-muted";
          const body = (
            <>
              <Icon name={item.icon} size={24} />
              <span className="type-label-md">{item.label}</span>
            </>
          );
          const shape =
            "flex h-[46px] w-[48px] flex-col items-center justify-center gap-[3px]";

          return item.href ? (
            <Link
              key={item.key}
              href={item.href}
              aria-current={selected ? "page" : undefined}
              className={`${shape} ${tone} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand`}
            >
              {body}
            </Link>
          ) : (
            // 맛지도 has no screen in this handoff — shown, but inert.
            <span
              key={item.key}
              aria-disabled="true"
              title="맛지도 화면은 이번 핸드오프 범위에 없습니다"
              className={`${shape} ${tone} cursor-not-allowed`}
            >
              {body}
            </span>
          );
        })}

        <Link
          href="/register"
          aria-label="맛집 등록"
          className="flex size-[48px] items-center justify-center rounded-full bg-background-brand text-text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
        >
          <Icon name="plus" size={32} />
        </Link>
      </PageContainer>
    </nav>
  );
}
