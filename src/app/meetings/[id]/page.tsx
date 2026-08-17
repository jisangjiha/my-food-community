import Image from "next/image";
import { notFound } from "next/navigation";

import { Icon } from "../../../components/foundation/Icon";
import { AppShell } from "../../../components/layout/AppShell";
import { FlowTopBar } from "../../../components/layout/FlowTopBar";
import { PageContainer } from "../../../components/layout/PageContainer";
import { MeetingInfoCard } from "../../../components/meetings/MeetingInfoCard";
import { MeetingPaySheet } from "../../../components/meetings/MeetingPaySheet";
import { RefundPolicyTable } from "../../../components/meetings/RefundPolicyTable";
import { Button } from "../../../components/ui/Button";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { NotFoundError } from "../../../lib/api/http";
import { getCurrentUser } from "../../../lib/auth/session";
import type { MeetingDto } from "../../../lib/meetings/dto";
import { formatWon } from "../../../lib/meetings/format";
import { getMeeting } from "../../../lib/meetings/service";
import { REFUND_BASIS_NOTE } from "../../../lib/payments/refund";
import { findPaidPaymentId } from "../../../lib/payments/service";

/**
 * 모임 상세 — design.pen `06 Meeting Detail`.
 *
 * 비로그인도 전체를 볼 수 있다(PRD 276). 로그인은 `결제하기`를 누를 때만 요구하고,
 * 돌아올 곳으로 `?pay=1`이 붙은 이 화면을 넘긴다. 시트의 열림 상태가 URL에 있어서
 * 로그인 왕복 뒤에도 사용자가 방금 누른 버튼을 다시 찾을 필요가 없다.
 *
 * 읽는 화면이라 본문 폭은 800에서 멈춘다. 결제 바는 모든 폭에서 화면 하단에
 * 고정된다 — 결제 CTA는 상시 보여야 하고(PRD 268), 폭에 따라 자리가 옮겨 다니면
 * 같은 흐름이 화면마다 달라 보인다.
 */
export default async function MeetingDetailPage(
  props: PageProps<"/meetings/[id]">,
) {
  const { id } = await props.params;
  const { pay } = await props.searchParams;

  const viewer = await getCurrentUser();
  const meeting = await loadMeeting(id);
  const paidId = viewer ? await findPaidPaymentId(meeting.id, viewer.id) : null;

  // 결제할 수 없는 상태에서 쿼리만 붙여 들어오는 경우가 있다. 시트를 띄우기 전에
  // 서버가 다시 판단한다 — 화면 상태를 URL이 정하게 두지 않는다.
  const sheetOpen =
    pay === "1" && Boolean(viewer) && !paidId && meeting.sale === "on_sale";

  return (
    <AppShell tabBar={false}>
      <FlowTopBar backHref="/" title="모임 상세" />

      <PageContainer
        as="main"
        width="article"
        // 하단 고정 바(80) + iOS 홈 인디케이터만큼 마지막 줄을 비운다.
        className="flex flex-col gap-4 py-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:py-32"
      >
        {/* 히어로 — 상품 이미지 한 장. 여러 장은 이번 범위 밖이라 점은 그리지 않는다. */}
        {meeting.imageUrl ? (
          <div className="relative aspect-[36/23] w-full overflow-hidden rounded-2xl md:aspect-[21/9]">
            <Image
              src={meeting.imageUrl}
              alt=""
              fill
              sizes="(min-width: 800px) 800px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        ) : (
          <div
            className="flex aspect-[36/23] w-full items-center justify-center rounded-2xl bg-background-brand-subtle text-text-subtle md:aspect-[21/9]"
            aria-hidden
          >
            <Icon name="image" size={32} />
          </div>
        )}

        <header className="flex flex-col gap-1.5">
          <span className="type-label-md text-text-brand">
            {meeting.categoryLabel}
          </span>
          <h1 className="type-heading-lg text-text-default md:type-display-sm">
            {meeting.title}
          </h1>
          <p className="type-body-md text-text-muted md:type-body-lg">
            {meeting.summary}
          </p>
        </header>

        <MeetingInfoCard meeting={meeting} />

        <section aria-labelledby="meeting-desc" className="flex flex-col gap-2">
          <h2 id="meeting-desc" className="type-heading-sm text-text-default">
            모임 소개
          </h2>
          <p className="type-body-md whitespace-pre-line text-text-muted md:type-body-lg">
            {meeting.description}
          </p>
        </section>

        <section
          aria-labelledby="meeting-refund"
          className="flex flex-col gap-2"
        >
          <h2 id="meeting-refund" className="type-heading-sm text-text-default">
            환불 규정
          </h2>
          <RefundPolicyTable />
          <p className="type-label-md text-text-subtle">{REFUND_BASIS_NOTE}</p>
        </section>
      </PageContainer>

      {/* 결제 바 — 시안 `Pay Bar`. 폭이 커져도 본문과 같은 800 안에서 정렬된다. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-default bg-background-surface pb-[env(safe-area-inset-bottom)]">
        <PageContainer
          width="article"
          className="flex items-center justify-between gap-3 py-4"
        >
          <span className="flex flex-col">
            <span className="type-label-md text-text-muted">1인</span>
            <span className="type-heading-md text-text-default">
              {formatWon(meeting.price)}
            </span>
          </span>
          <PayAction
            meeting={meeting}
            signedIn={Boolean(viewer)}
            paid={Boolean(paidId)}
          />
        </PageContainer>
      </div>

      {sheetOpen && (
        <MeetingPaySheet
          meetingId={meeting.id}
          price={meeting.price}
          seatsTaken={meeting.seatsTaken}
          capacity={meeting.capacity}
          seatsLeft={meeting.seatsLeft}
          maxSelectable={meeting.maxSelectable}
          maxPerPerson={meeting.maxPerPerson}
          closeHref={`/meetings/${meeting.id}`}
        />
      )}
    </AppShell>
  );
}

/**
 * 상태별 CTA — PRD 269의 표 그대로.
 *
 * 비활성 버튼은 `Button`(누를 수 없는 링크를 만들지 않는다), 이동하는 것은
 * `ButtonLink`다.
 */
function PayAction({
  meeting,
  signedIn,
  paid,
}: {
  meeting: MeetingDto;
  signedIn: boolean;
  paid: boolean;
}) {
  if (paid) {
    return (
      <ButtonLink href="/my?tab=payments" variant="secondary" size="lg">
        결제 내역 보기
      </ButtonLink>
    );
  }
  if (meeting.sale === "closed") {
    return (
      <Button size="lg" disabled>
        모집 종료
      </Button>
    );
  }
  if (meeting.sale === "sold_out") {
    return (
      <Button size="lg" disabled>
        정원 마감
      </Button>
    );
  }

  const sheetHref = `/meetings/${meeting.id}?pay=1`;

  return (
    <ButtonLink
      href={
        signedIn ? sheetHref : `/login?next=${encodeURIComponent(sheetHref)}`
      }
      size="lg"
      scroll={false}
    >
      결제하기
    </ButtonLink>
  );
}

/** 없는 모임과 잘못된 id는 똑같이 404다. 던지면 500이 되고 "고장난 페이지"가 된다. */
async function loadMeeting(id: string): Promise<MeetingDto> {
  try {
    return await getMeeting(id);
  } catch (reason) {
    if (reason instanceof NotFoundError) {
      notFound();
    }
    throw reason;
  }
}
