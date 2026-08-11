import Link from "next/link";

export interface PlaceResultItemProps {
  /** 고르면 가는 곳. 장소 검색 결과는 곧바로 장소 등록 화면으로 넘어간다. */
  href: string;
  name: string;
  address: string;
}

/**
 * 장소 검색 결과 한 줄 — design.pen `04a Place Search - Results`의 `Result *`.
 *
 * 시안에는 눌린 상태가 없지만 실제로는 누르는 줄이므로 링크로 만들고 hover/focus를
 * 붙였다. 시안이 그린 라운드 8은 그 상태가 보일 자리를 미리 비워 둔 것이다.
 */
export function PlaceResultItem({ href, name, address }: PlaceResultItemProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 hover:bg-background-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
    >
      <span
        className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-background-brand-subtle"
        aria-hidden
      >
        <span className="size-[10px] rounded-full bg-background-brand" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-body-lg text-text-default">{name}</span>
        <span className="type-label-md text-text-muted">{address}</span>
      </span>
    </Link>
  );
}
