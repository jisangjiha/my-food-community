import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "../foundation/Icon";

export interface FlowTopBarProps {
  /** 뒤로 갈 곳. 브라우저 히스토리가 아니라 흐름상의 이전 화면이다. */
  backHref: string;
  title: string;
  /** 오른쪽 끝 보조 액션 — 등록 화면의 "임시저장" 같은 것. */
  action?: ReactNode;
}

/**
 * 흐름 화면(등록·장소 등록·장소 검색)의 폰 상단 바.
 *
 * design.pen의 04/04a/04b 프레임은 상단 바를 캔버스 위에 테두리 없이 그리지만,
 * 이 앱의 상세·등록 화면은 이미 sticky + 아래 테두리로 통일돼 있다. 한 흐름
 * 안에서 화면마다 상단 바가 달라 보이는 쪽이 더 어색하므로 앱 쪽에 맞춘다.
 *
 * `md`부터는 `SiteHeader`가 대신하므로 숨는다. 두 내비게이션 표면이 동시에
 * 보이면 안 된다.
 */
export function FlowTopBar({ backHref, title, action }: FlowTopBarProps) {
  return (
    <div className="sticky top-0 z-30 border-b border-border-default bg-background-surface md:hidden">
      <div className="flex h-14 items-center gap-3 px-2">
        <Link
          href={backHref}
          aria-label="뒤로"
          className="flex size-10 shrink-0 items-center justify-center text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
        >
          <Icon name="arrow-left" size={24} />
        </Link>
        <h1 className="type-heading-sm min-w-0 flex-1 truncate text-text-default">
          {title}
        </h1>
        {action}
      </div>
    </div>
  );
}
