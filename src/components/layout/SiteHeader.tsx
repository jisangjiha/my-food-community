"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "../foundation/Icon";
import { ButtonLink } from "../ui/ButtonLink";
import { PageContainer } from "./PageContainer";
import { NAV_ITEMS, activeKey } from "./nav-items";

/**
 * The md+ replacement for the phone tab bar.
 *
 * design.pen has no desktop screen; this is the agreed expansion — from md the
 * bottom bar moves up into a sticky header and the bar's `+` becomes the
 * header's 등록 button. Everything is drawn from the same tokens and the same
 * `NAV_ITEMS` list as the phone bar.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const active = activeKey(pathname);

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border-default bg-background-surface md:block">
      <PageContainer className="flex h-[64px] items-center gap-24">
        <Link
          href="/"
          className="flex shrink-0 flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
        >
          <span className="type-label-md text-text-brand">숨은맛집</span>
          <span className="type-heading-sm text-text-default">Hidden Eats</span>
        </Link>

        <nav aria-label="주요 메뉴" className="flex flex-1 items-center gap-1">
          {NAV_ITEMS.filter((item) => item.key !== "register").map((item) => {
            const selected = item.key === active;
            const tone = selected ? "text-text-brand" : "text-text-muted";
            const body = (
              <>
                <Icon name={item.icon} size={20} />
                <span className="type-label-lg">{item.label}</span>
              </>
            );
            const shape = "flex h-10 items-center gap-2 rounded-lg px-3";

            return item.href ? (
              <Link
                key={item.key}
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={`${shape} ${tone} hover:bg-background-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand`}
              >
                {body}
              </Link>
            ) : (
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
        </nav>

        <ButtonLink href="/register" leadingIcon="plus" className="shrink-0">
          등록
        </ButtonLink>
      </PageContainer>
    </header>
  );
}
