import Link from "next/link";
import { redirect } from "next/navigation";

import { Icon } from "../../components/foundation/Icon";
import { AppShell } from "../../components/layout/AppShell";
import { PageContainer } from "../../components/layout/PageContainer";
import { PlaceForm } from "../../components/places/PlaceForm";
import { readLocationDraftFromQuery } from "../../lib/places/location";

/**
 * 맛집 등록 — design.pen `03 Register Page - Place Entry`.
 *
 * 장소를 먼저 고르는 순서다. 주소와 좌표가 실려 오지 않았으면 `/register/place`로
 * 보낸다. "지도 정보는 필수"라는 규칙이 여기 한 곳에서 강제되고, 사용자는 빈 폼
 * 앞에서 무엇부터 해야 하나 고민하지 않는다.
 *
 * 장소명까지 요구하지는 않는다. 지도를 드래그해 위치를 잡으면 상호명이 없는데,
 * 그때 되돌려보내면 빠져나올 수 없는 고리가 된다. 이름은 폼에서 받는다.
 *
 * "임시저장"은 없앴다. 저장할 곳이 없어 눌리는 척만 하는 버튼이었다.
 */
export default async function RegisterPage(props: PageProps<"/register">) {
  const location = readLocationDraftFromQuery(await props.searchParams);
  if (!location) {
    redirect("/register/place");
  }

  return (
    <AppShell tabBar={false}>
      {/* Phone top bar — replaced by SiteHeader from md. */}
      <div className="sticky top-0 z-30 border-b border-border-default bg-background-surface md:hidden">
        <div className="flex h-14 items-center justify-between px-3">
          <Link
            href="/"
            aria-label="닫기"
            className="flex size-6 items-center justify-center text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
          >
            <Icon name="close" size={24} />
          </Link>
          <h1 className="type-heading-sm text-text-default">맛집 등록</h1>
          {/* 닫기 버튼과 같은 폭을 차지해 제목이 가운데 온다. */}
          <span className="size-6" aria-hidden />
        </div>
      </div>

      {/* 폼뿐인 화면이라 폭은 640에서 멈춘다. */}
      <PageContainer
        as="main"
        width="form"
        className="flex flex-col gap-4 py-4 md:py-32"
      >
        <h1 className="hidden type-display-sm text-text-default md:block">
          맛집 등록
        </h1>

        <PlaceForm location={location} />
      </PageContainer>
    </AppShell>
  );
}
