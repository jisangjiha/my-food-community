import { notFound, redirect } from "next/navigation";

import { Icon } from "../../../components/foundation/Icon";
import { AppShell } from "../../../components/layout/AppShell";
import { PageContainer } from "../../../components/layout/PageContainer";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { DetailRow } from "../../../components/ui/DetailRow";
import { NotFoundError } from "../../../lib/api/http";
import { getCurrentUser } from "../../../lib/auth/session";
import {
  formatMeetingDateTime,
  formatTimestamp,
  formatWon,
} from "../../../lib/meetings/format";
import type { PaymentDto } from "../../../lib/payments/dto";
import { getPaymentByOrderNo } from "../../../lib/payments/service";

/**
 * 결제 완료 — design.pen `07 Payment Complete`.
 *
 * 주문번호로 조회하는 화면이다. 새로 고치거나 뒤로 갔다 다시 와도 결제가 다시
 * 일어나지 않는다(PRD 299). 결제를 일으키는 것은 서버 액션 한 곳뿐이다.
 *
 * 남의 주문번호는 RLS에 걸려 404가 된다.
 */
export default async function PaymentCompletePage(
  props: PageProps<"/payments/[orderNo]">,
) {
  const { orderNo } = await props.params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/payments/${orderNo}`)}`);
  }
  const payment = await loadPayment(orderNo, user.id);

  return (
    <AppShell tabBar={false}>
      <PageContainer
        as="main"
        width="form"
        className="flex flex-col gap-4 py-24 md:py-32"
      >
        <header className="flex flex-col items-center gap-2.5 pt-4 pb-2">
          <span
            className="flex size-[72px] items-center justify-center rounded-full bg-background-success text-text-success"
            aria-hidden
          >
            <Icon name="check" size={32} />
          </span>
          <h1 className="type-heading-lg text-text-default md:type-display-sm">
            결제가 완료되었어요
          </h1>
          <p className="type-body-md text-center text-text-muted">
            {`${payment.meeting.title} 신청이 확정되었어요.`}
          </p>
        </header>

        <section
          aria-label="결제 정보"
          className="flex flex-col gap-3 rounded-2xl border border-border-default bg-background-surface p-4"
        >
          <DetailRow label="주문번호">{payment.orderNo}</DetailRow>
          <DetailRow label="모임">{payment.meeting.title}</DetailRow>
          <DetailRow label="일시">
            {formatMeetingDateTime(payment.meeting.startsAt)}
          </DetailRow>
          <DetailRow label="장소">{payment.meeting.address}</DetailRow>
          <DetailRow label="참여 인원">{`${payment.headcount}명`}</DetailRow>

          <span aria-hidden className="h-px w-full bg-border-default" />

          <DetailRow label="결제 금액" tone="text-text-brand">
            {formatWon(payment.amount)}
          </DetailRow>
          <DetailRow label="결제 수단">{payment.method}</DetailRow>
          <DetailRow label="결제 일시">
            {formatTimestamp(payment.paidAt)}
          </DetailRow>
        </section>

        <p className="type-label-md text-text-subtle">
          결제 내역은 마이 페이지 &gt; 결제 내역에서 확인할 수 있어요. 모임 3일
          전까지 취소 시 차등 환불됩니다.
        </p>

        <div className="flex flex-col gap-2">
          <ButtonLink href="/my?tab=payments" size="lg" className="w-full">
            결제 내역 보기
          </ButtonLink>
          <ButtonLink href="/" variant="secondary" size="lg" className="w-full">
            메인으로 돌아가기
          </ButtonLink>
        </div>
      </PageContainer>
    </AppShell>
  );
}

/** 없는 주문과 남의 주문은 똑같이 404다. */
async function loadPayment(
  orderNo: string,
  userId: string,
): Promise<PaymentDto> {
  try {
    return await getPaymentByOrderNo(orderNo, userId);
  } catch (reason) {
    if (reason instanceof NotFoundError) {
      notFound();
    }
    throw reason;
  }
}
