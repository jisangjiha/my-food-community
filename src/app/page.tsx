import Image from "next/image";
import Link from "next/link";

import { Icon } from "../components/foundation/Icon";
import { AppShell } from "../components/layout/AppShell";
import { PageContainer } from "../components/layout/PageContainer";
import { MeetingBanner } from "../components/meetings/MeetingBanner";
import { Chip } from "../components/ui/Chip";
import { Empty } from "../components/ui/Empty";
import { RestaurantCard } from "../components/ui/RestaurantCard";
import { TextField } from "../components/ui/TextField";
import { toBannerItem } from "../lib/meetings/dto";
import { listMeetings } from "../lib/meetings/service";
import { PLACE_PENDING_ADDRESS } from "../lib/places/dto";
import { formatPlaceDate } from "../lib/places/format";
import { listPlaces } from "../lib/places/service";
import { categories, featured } from "../lib/restaurants";

/**
 * 홈 피드.
 *
 * 카드와 추천 배너는 DB에서 온다. 서버 컴포넌트라 서비스 함수를 직접 부른다.
 *
 * 검색창과 카테고리 칩은 아직 시안 그대로다. 거는 곳이 없어 눌러도 목록이
 * 바뀌지 않지만, 죽은 링크를 만들지는 않으므로 자리만 지키고 있다.
 */
export default async function MainPage() {
  // 두 목록은 서로를 기다리지 않는다.
  const [places, meetings] = await Promise.all([listPlaces(), listMeetings()]);
  // 배너는 가장 최근 글을 세운다. 목록이 최신순이라 첫 칸이 그것이다.
  // 그 글은 아래 목록에도 그대로 남는다. 빼면 글이 한 개일 때 목록이 비어 버린다.
  const latest = places[0];

  return (
    <AppShell>
      <PageContainer as="main" className="flex flex-col gap-4 py-4 md:gap-24 md:py-32">
        {/* Phone-only page header. From md the sticky SiteHeader carries the brand. */}
        <header className="flex items-center justify-between p-1 md:hidden">
          <div className="flex flex-col gap-px">
            <span className="type-label-md text-text-brand">숨은맛집</span>
            <h1 className="type-heading-lg text-text-default">오늘 어디 갈까?</h1>
          </div>
          <div className="flex items-center gap-2">
            <Chip>반경 8km</Chip>
            <span className="flex size-5 items-center justify-center text-text-brand-strong">
              <Icon name="notification" size={20} label="알림" />
            </span>
          </div>
        </header>

        <h1 className="hidden type-display-sm text-text-default md:block">
          오늘 어디 갈까?
        </h1>

        {/*
          모임 배너 — design.pen `01b Main Page - Banner`. 목록 맨 위에 있고 스크롤과
          함께 밀려 올라간다(고정 아님, PRD 254). 상품이 없으면 컴포넌트가 아무것도
          그리지 않는다.
        */}
        <MeetingBanner meetings={meetings.map(toBannerItem)} />

        {/*
          Featured — side by side on phones, a wide banner from md.
          올라온 글이 하나도 없으면 배너 자체를 뺀다. 시안의 목업 문구를 남겨 두면
          비어 있는 피드 위에서 있지도 않은 추천을 가리키게 된다.
        */}
        {latest && (
          <Link
            href={`/restaurants/${latest.id}`}
            className="flex flex-col gap-2 rounded-2xl bg-background-brand-muted p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand md:flex-row md:items-center md:gap-24 md:p-4"
            style={{ boxShadow: "0 3px 10px #5B3A620F" }}
          >
            <div className="flex items-start gap-2 md:flex-1 md:gap-24">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="type-label-md text-text-brand">
                  {featured.badge}
                </span>
                <span className="type-heading-sm truncate text-text-default md:type-heading-lg">
                  {latest.title}
                </span>
                <span className="type-label-md truncate text-text-muted md:type-body-lg">
                  {latest.author?.nickname ?? "이웃"} ·{" "}
                  {formatPlaceDate(latest.createdAt)}
                </span>
              </div>
              {latest.images[0] && (
                <div className="relative h-[66px] w-[78px] shrink-0 overflow-hidden rounded-2xl md:hidden">
                  <Image
                    src={latest.images[0].url}
                    alt=""
                    fill
                    sizes="78px"
                    className="object-cover"
                    priority
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {featured.chips.map((chip, index) => (
                // Presentational inside a link — the whole banner is the target.
                <span
                  key={chip}
                  className={`inline-flex h-[32px] shrink-0 items-center justify-center rounded-2xl px-4 type-label-lg ${
                    index === 0
                      ? "bg-background-brand text-text-on-brand"
                      : "border border-border-strong bg-background-surface text-text-default"
                  }`}
                >
                  {chip}
                </span>
              ))}
            </div>

            {latest.images[0] && (
              <div className="relative hidden h-[140px] w-[200px] shrink-0 overflow-hidden rounded-2xl md:block lg:h-[160px] lg:w-[260px]">
                <Image
                  src={latest.images[0].url}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 260px, 200px"
                  className="object-cover"
                  priority
                />
              </div>
            )}
          </Link>
        )}

        {/* Search + categories: stacked on phones, one row from lg. */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-24">
          <TextField
            leadingIcon="search"
            placeholder="맛집 이름, 메뉴, 동네 검색"
            aria-label="맛집 검색"
            className="lg:w-[360px] lg:shrink-0"
          />
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
            {categories.map((category, index) => (
              <Chip key={category} selected={index === 0}>
                {category}
              </Chip>
            ))}
          </div>
        </div>

        {/* The card grid — 1 → 2 → 3 → 4 columns, capped by PageContainer at 1280. */}
        <section aria-label="맛집 목록">
          {places.length === 0 ? (
            <Empty
              icon="search"
              title="아직 올라온 곳이 없어요"
              description="첫 번째 맛집을 등록해 이웃에게 알려주세요."
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {places.map((place) => (
                <li key={place.id} className="flex">
                  <RestaurantCard
                    href={`/restaurants/${place.id}`}
                    name={place.title}
                    summary={place.content}
                    meta={`${place.location?.address ?? PLACE_PENDING_ADDRESS} · ${formatPlaceDate(place.createdAt)}`}
                    image={place.images[0]?.url ?? "/images/mango-table.png"}
                    className="w-full"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageContainer>
    </AppShell>
  );
}
