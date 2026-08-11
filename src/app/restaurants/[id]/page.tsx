import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "../../../components/foundation/Icon";
import { AppShell } from "../../../components/layout/AppShell";
import { PageContainer } from "../../../components/layout/PageContainer";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { MapPreview } from "../../../components/ui/MapPreview";
import { NaverMap } from "../../../components/ui/NaverMap";
import { NotFoundError } from "../../../lib/api/http";
import { getCurrentUser } from "../../../lib/auth/session";
import { NAVER_MAP_CLIENT_ID } from "../../../lib/maps/env";
import { PLACE_PENDING_ADDRESS, type PlaceDto } from "../../../lib/places/dto";
import { formatPlaceDate } from "../../../lib/places/format";
import { getPlace } from "../../../lib/places/service";

/**
 * 맛집 상세.
 *
 * design.pen의 시안에는 평점·후기·예상 비용·영업 상태·지도가 있지만, 지금
 * `place` 테이블에는 그 값이 없다. 없는 것을 0이나 "-"로 채우면 화면이 데이터가
 * 있는 척을 하게 되므로, 가진 것(제목·사진·본문·작성자·등록일)만으로 다시 짰다.
 * 스키마가 자라면 그때 시안의 나머지 칸을 되살린다.
 *
 * 서버 컴포넌트라 서비스 함수를 직접 부른다. 자기 앱의 `/api/places/{id}`를
 * fetch 하면 왕복이 하나 늘고 쿠키를 다시 실어 보내야 한다.
 *
 * `generateStaticParams`는 없앴다. 목록이 DB에 있으니 빌드 시점에 알 수 없고,
 * 글이 수정·삭제되면 미리 구워 둔 페이지가 거짓말을 한다.
 */
export default async function DetailPage(props: PageProps<"/restaurants/[id]">) {
  const { id } = await props.params;

  // 상세는 비로그인도 볼 수 있다. 사용자는 isMine 계산에만 쓴다.
  const viewer = await getCurrentUser();
  const place = await loadPlace(id, viewer?.id ?? null);

  const [hero, ...rest] = place.images;
  // 지도를 그릴지는 주소 문자열이 아니라 좌표가 정한다. 주소만 있고 좌표가 없는
  // 행이 실제로 있고, 그런 글에 지도를 깔면 화면이 아무 동네나 가리킨다.
  const location = place.location;

  return (
    <AppShell tabBar={false}>
      {/* Phone top bar — replaced by SiteHeader from md. */}
      <div className="sticky top-0 z-30 border-b border-border-default bg-background-surface md:hidden">
        <div className="flex h-14 items-center gap-1 px-2">
          <Link
            href="/"
            aria-label="뒤로"
            className="flex size-10 shrink-0 items-center justify-center text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
          >
            <Icon name="arrow-left" size={24} />
          </Link>
          <h1 className="type-heading-sm truncate text-text-default">맛집 상세</h1>
        </div>
      </div>

      {/* 읽는 화면이라 본문 폭은 800에서 멈춘다. */}
      <PageContainer
        as="main"
        width="article"
        className="flex flex-col gap-4 py-4 md:py-32"
      >
        <article className="overflow-hidden rounded-2xl border border-border-default bg-background-surface">
          {hero ? (
            <div className="relative aspect-[328/138] w-full md:aspect-[21/9]">
              <Image
                src={hero.url}
                alt=""
                fill
                sizes="(min-width: 800px) 800px, 100vw"
                className="object-cover"
                priority
              />
              {/* 사진 위에 글자를 얹으므로 어둡게 덮는다. 대비가 없으면 밝은
                  사진에서 제목이 사라진다. */}
              <div className="absolute inset-0 bg-background-overlay/27" aria-hidden />
              <h2 className="absolute inset-x-0 bottom-0 p-3 type-heading-lg text-text-on-brand md:p-24 md:type-display-sm">
                {place.title}
              </h2>
            </div>
          ) : (
            // 사진은 등록 때 필수지만, 그전에 들어온 글이 있을 수 있다.
            <h2 className="px-3.5 pt-3.5 type-heading-lg text-text-default md:px-24 md:pt-5 md:type-display-sm">
              {place.title}
            </h2>
          )}

          <div className="flex flex-col gap-2.5 px-3.5 pb-3 pt-3.5 md:px-24 md:pb-5 md:pt-5">
            <div className="flex items-center gap-2">
              <Author author={place.author} />
              <span className="type-label-md text-border-strong">|</span>
              <span className="type-label-md text-text-subtle">
                {formatPlaceDate(place.createdAt)}
              </span>
            </div>

            <p className="type-body-md whitespace-pre-line text-text-default md:type-body-lg">
              {place.content}
            </p>
          </div>
        </article>

        {/*
          위치 — design.pen `02b Detail Page - Map`.

          좌표가 있는 글에만 지도를 그린다. 지도 정보가 필수가 되기 전에 들어온
          행은 `lat`/`lng`가 비어 있어, 그런 글에는 주소 카드만 남는다. 좌표를
          모르는데 지도를 깔면 화면이 아무 동네나 가리키면서 아는 척을 하게 된다.
        */}
        <section aria-labelledby="place-location" className="flex flex-col gap-2">
          <h2 id="place-location" className="type-label-md text-text-brand">
            위치
          </h2>
          {location && (
            <NaverMap
              label={location.name}
              clientId={NAVER_MAP_CLIENT_ID}
              center={{ lat: location.lat, lng: location.lng }}
              variant="static"
              size="sm"
              className="md:h-[240px] lg:h-[280px]"
            />
          )}
          <MapPreview
            address={location?.address ?? PLACE_PENDING_ADDRESS}
            state={location ? "filled" : "empty"}
          />
        </section>

        {/*
          `isMine`은 지금까지 계산만 되고 쓰이지 않았다. 여기가 그 자리다.
          삭제는 마이페이지에 이미 있어 여기 두지 않는다.
        */}
        {place.isMine && (
          <ButtonLink
            href={`/restaurants/${place.id}/edit`}
            variant="secondary"
            leadingIcon="edit"
            className="w-full"
          >
            수정
          </ButtonLink>
        )}

        {rest.length > 0 && (
          <section
            aria-label="사진"
            className="grid grid-cols-2 gap-2 md:grid-cols-3"
          >
            {rest.map((image) => (
              <div
                key={image.path}
                className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-background-subtle"
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 256px, 45vw"
                  className="object-cover"
                />
              </div>
            ))}
          </section>
        )}
      </PageContainer>
    </AppShell>
  );
}

/** 작성자 한 줄. 프로필이 지워진 글도 있을 수 있어 없는 경우를 함께 다룬다. */
function Author({ author }: { author: PlaceDto["author"] }) {
  if (!author) {
    return <span className="type-label-md text-text-subtle">알 수 없는 사용자</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background-brand-muted text-text-brand"
        aria-hidden
      >
        {author.avatarUrl ? (
          <Image src={author.avatarUrl} alt="" fill sizes="24px" className="object-cover" />
        ) : (
          <Icon name="user" size={16} />
        )}
      </span>
      <span className="type-label-md truncate text-text-default">
        {author.nickname}
      </span>
    </span>
  );
}

/**
 * 없는 글과 지워진 글은 똑같이 404다.
 *
 * 서비스가 던지는 `NotFoundError`를 Next의 `notFound()`로 옮긴다. 그냥 두면
 * 500이 되고, 사용자는 "없는 페이지"가 아니라 "고장난 페이지"를 보게 된다.
 */
async function loadPlace(id: string, viewerId: string | null): Promise<PlaceDto> {
  try {
    return await getPlace(id, viewerId);
  } catch (reason) {
    if (reason instanceof NotFoundError) {
      notFound();
    }
    throw reason;
  }
}
