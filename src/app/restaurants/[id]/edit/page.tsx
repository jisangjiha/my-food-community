import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Icon } from "../../../../components/foundation/Icon";
import { AppShell } from "../../../../components/layout/AppShell";
import { PageContainer } from "../../../../components/layout/PageContainer";
import { PlaceForm } from "../../../../components/places/PlaceForm";
import { NotFoundError } from "../../../../lib/api/http";
import { getCurrentUser } from "../../../../lib/auth/session";
import type { PlaceDto } from "../../../../lib/places/dto";
import { readLocationDraftFromQuery } from "../../../../lib/places/location";
import { getPlace } from "../../../../lib/places/service";

/**
 * 맛집 수정.
 *
 * `/restaurants/**`는 미들웨어의 보호 목록(`/my`, `/register`)에 없다. 그래서
 * 권한을 여기서 직접 본다 — 내 글이 아니면 `notFound()`다. `updatePlace`도 403을
 * 주지만 그건 저장 버튼을 누른 뒤고, 남의 글 내용이 폼에 채워지는 것 자체가 새는
 * 것이다.
 *
 * 403이 아니라 404인 이유: "남의 글이라 못 고친다"는 응답은 그 글이 있다는 사실을
 * 알려 준다. 없는 글과 같이 다루면 화면도 하나 덜 만든다.
 *
 * 장소는 세 곳에서 온다. 쿼리(장소를 바꾸고 돌아온 경우) → 글에 저장된 값 →
 * 둘 다 없으면 장소 선택으로 보낸다. 세 번째는 지도 정보가 필수가 되기 전에
 * 들어온 행이다.
 */
export default async function PlaceEditPage(
  props: PageProps<"/restaurants/[id]/edit">,
) {
  const { id } = await props.params;

  const viewer = await getCurrentUser();
  const place = await loadOwnPlace(id, viewer?.id ?? null);

  const editPath = `/restaurants/${place.id}/edit`;
  const location =
    readLocationDraftFromQuery(await props.searchParams) ?? place.location;
  if (!location) {
    redirect(`/register/place?returnTo=${encodeURIComponent(editPath)}`);
  }

  return (
    <AppShell tabBar={false}>
      {/* Phone top bar — replaced by SiteHeader from md. */}
      <div className="sticky top-0 z-30 border-b border-border-default bg-background-surface md:hidden">
        <div className="flex h-14 items-center justify-between px-3">
          <Link
            href={`/restaurants/${place.id}`}
            aria-label="닫기"
            className="flex size-6 items-center justify-center text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
          >
            <Icon name="close" size={24} />
          </Link>
          <h1 className="type-heading-sm text-text-default">맛집 수정</h1>
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
          맛집 수정
        </h1>

        <PlaceForm location={location} place={place} />
      </PageContainer>
    </AppShell>
  );
}

/** 내 글만 돌려준다. 없는 글·지운 글·남의 글은 모두 404다. */
async function loadOwnPlace(
  id: string,
  viewerId: string | null,
): Promise<PlaceDto> {
  try {
    const place = await getPlace(id, viewerId);
    if (!place.isMine) notFound();
    return place;
  } catch (reason) {
    if (reason instanceof NotFoundError) notFound();
    throw reason;
  }
}
