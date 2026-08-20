import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Icon } from "../../components/foundation/Icon";
import { AppShell } from "../../components/layout/AppShell";
import { PageContainer, WIDTHS } from "../../components/layout/PageContainer";
import { CancellationCard } from "../../components/payments/CancellationCard";
import { PaymentHistoryCard } from "../../components/payments/PaymentHistoryCard";
import { Button } from "../../components/ui/Button";
import { ButtonLink } from "../../components/ui/ButtonLink";
import { Empty } from "../../components/ui/Empty";
import { TabNavigation } from "../../components/ui/Navigation";
import { RestaurantCard } from "../../components/ui/RestaurantCard";
import { StatTile } from "../../components/ui/StatTile";
import { DeletePlaceButton } from "./DeletePlaceButton";
import { signOut } from "../../lib/auth/actions";
import { getCurrentUser } from "../../lib/auth/session";
import { REFUND_DELAY_NOTE } from "../../lib/payments/dto";
import {
  listMyCancellations,
  listMyPayments,
} from "../../lib/payments/service";
import { PLACE_PENDING_ADDRESS } from "../../lib/places/dto";
import { formatPlaceDate } from "../../lib/places/format";
import { listPlaces } from "../../lib/places/service";
import { getMyProfile } from "../../lib/profile/service";

/** 마이 페이지의 세 탭. 순서가 화면 순서다. */
const MY_TABS = [
  { key: "posts", label: "내가 쓴 글", href: "/my" },
  { key: "payments", label: "결제 내역", href: "/my?tab=payments" },
  { key: "cancels", label: "취소 내역", href: "/my?tab=cancels" },
] as const;

type MyTabKey = (typeof MY_TABS)[number]["key"];

function toTabKey(value: string | string[] | undefined): MyTabKey {
  const key = Array.isArray(value) ? value[0] : value;
  return MY_TABS.some((tab) => tab.key === key) ? (key as MyTabKey) : "posts";
}

/**
 * 마이 페이지.
 *
 * 서버 컴포넌트라 서비스 함수를 그대로 부른다. 자기 앱의 `/api/me/places`를
 * fetch 하면 왕복이 하나 늘고 쿠키를 다시 실어 보내야 한다. 같은 라우트는
 * 클라이언트에서 필요할 때 쓰라고 남겨 둔 것이다.
 *
 * proxy가 비로그인 접근을 이미 `/login`으로 돌리지만 여기서 한 번 더 확인한다.
 * 인가를 프록시 한 겹에만 기대지 않는다. 여기서 예외를 던지면 500이 되므로,
 * 프록시와 같은 곳으로 보낸다.
 *
 * 탭 전환은 `?tab=`으로 서버에서 한다. 세 탭의 데이터 출처가 모두 달라(글 / 결제 /
 * 취소) 클라이언트에서 전환하면 안 보는 목록까지 매번 내려보내야 한다.
 *
 * 이 화면은 읽기만 한다. 결제 취소는 카드 안의 클라이언트 조각이 BFF 라우트를
 * 부르고, 끝나면 `router.refresh()`로 이 화면이 다시 그려진다.
 */
export default async function MyPage(props: PageProps<"/my">) {
  const { tab } = await props.searchParams;
  const activeTab = toTabKey(tab);

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/my")}`);
  }

  // 활성 탭의 것만 읽는다. 세 목록을 다 읽으면 안 보는 것까지 매번 조회한다.
  const [profile, posts, payments, cancellations] = await Promise.all([
    getMyProfile(user),
    activeTab === "posts"
      ? listPlaces({ viewerId: user.id, authorId: user.id })
      : Promise.resolve([]),
    activeTab === "payments" ? listMyPayments() : Promise.resolve([]),
    activeTab === "cancels" ? listMyCancellations() : Promise.resolve([]),
  ]);

  const stats = [
    { value: String(profile.stats.places), label: "등록" },
    { value: String(profile.stats.saves), label: "저장" },
    { value: String(profile.stats.reviews), label: "후기" },
  ];

  return (
    <AppShell>
      <PageContainer as="main" className="flex flex-col gap-4 py-4 md:gap-24 md:py-32">
        {/* Profile block stays at a readable width; only the post grid goes to 1280. */}
        <div className={`flex w-full flex-col gap-4 ${WIDTHS.article}`}>
          <header className="flex items-center justify-between p-1">
            <div className="flex flex-col gap-px">
              <span className="type-label-md text-text-brand">내 활동</span>
              <h1 className="type-heading-lg text-text-default md:type-display-sm">
                마이 페이지
              </h1>
            </div>
            {/*
              design.pen은 설정 아이콘만 그린다. 로그아웃은 시안에 없지만 로그인이
              있는 이상 나가는 길도 있어야 한다. 계정 관련 조작이 모이는 자리라
              설정 옆에 두고, 버튼은 기존 secondary 스펙을 그대로 쓴다.
            */}
            <div className="flex items-center gap-1">
              <form action={signOut}>
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  leadingIcon="logout"
                >
                  로그아웃
                </Button>
              </form>
              <button
                type="button"
                aria-label="설정"
                className="flex size-10 cursor-pointer items-center justify-center text-text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
              >
                <Icon name="settings" size={20} />
              </button>
            </div>
          </header>

          <section className="flex items-center gap-3 rounded-2xl bg-background-surface p-3 md:p-4">
            <span
              className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background-brand-muted text-text-brand md:size-[64px]"
              aria-hidden
            >
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <Icon name="user" size={32} />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="type-heading-sm truncate text-text-default">
                {profile.nickname}
              </p>
              <p className="type-label-md truncate text-text-muted">
                {profile.handle}
              </p>
            </div>
            <Link
              href="/my/edit"
              aria-label="프로필 수정"
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center text-text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
            >
              <Icon name="edit" size={20} />
            </Link>
          </section>

          <section aria-label="활동 요약" className="flex gap-2">
            {stats.map((stat) => (
              <StatTile key={stat.label} value={stat.value} label={stat.label} />
            ))}
          </section>

          <TabNavigation
            variant="inline"
            value={MY_TABS.findIndex((item) => item.key === activeTab)}
            tabs={MY_TABS.map((item) => ({
              label: item.label,
              href: item.href,
            }))}
          />
        </div>

        {activeTab === "posts" && (
          <section aria-label="내가 쓴 글">
            {posts.length === 0 ? (
              <Empty
                icon="edit"
                title="아직 등록한 곳이 없어요"
                description="다녀온 곳을 올리면 이웃이 찾아갑니다."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {posts.map((place) => (
                  // 삭제 버튼을 카드 위에 겹치기 위한 기준점. 카드 자체는 링크라
                  // 안에 버튼을 넣을 수 없다.
                  <li key={place.id} className="relative flex">
                    <DeletePlaceButton id={place.id} title={place.title} />
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
        )}

        {activeTab === "payments" && (
          // 읽는 목록이라 800에서 멈춘다. 숫자를 다시 적지 않도록 PageContainer의
          // 폭 표를 쓴다 — 폭 규칙은 한 곳에만 있어야 한다.
          <section aria-label="결제 내역" className={`w-full ${WIDTHS.article}`}>
            {payments.length === 0 ? (
              <Empty
                icon="calendar"
                title="아직 결제한 상품이 없어요"
                description="상품 목록에서 이번 달 모임을 볼 수 있어요."
                actions={
                  <ButtonLink href="/products" variant="secondary" size="md">
                    상품 보러 가기
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {payments.map((payment) => (
                  <PaymentHistoryCard key={payment.id} payment={payment} />
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === "cancels" && (
          <section
            aria-label="취소 내역"
            className={`flex w-full flex-col gap-3 ${WIDTHS.article}`}
          >
            {/* 탭 상단 고정 안내. 목록이 비어도 보인다. */}
            <p className="type-label-md flex items-center gap-2 rounded-[10px] bg-background-subtle px-3 py-2.5 text-text-muted">
              <Icon name="info" size={20} />
              {REFUND_DELAY_NOTE}
            </p>
            {cancellations.length === 0 ? (
              <Empty
                icon="refresh"
                title="취소한 내역이 없어요"
                description="결제한 상품을 취소하면 여기에 남아요."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {cancellations.map((cancellation) => (
                  <CancellationCard
                    key={cancellation.id}
                    cancellation={cancellation}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
      </PageContainer>
    </AppShell>
  );
}
