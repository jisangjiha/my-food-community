import { notFound } from "next/navigation";

import { Icon } from "../../../components/foundation/Icon";
import { AppShell } from "../../../components/layout/AppShell";
import { PageContainer } from "../../../components/layout/PageContainer";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { DetailRow } from "../../../components/ui/DetailRow";
import { NotFoundError } from "../../../lib/api/http";
import { UnauthorizedError } from "../../../lib/auth/session";
import type { PaymentDto } from "../../../lib/payments/dto";
import { formatPaymentDateTime } from "../../../lib/payments/format";
import { getPayment } from "../../../lib/payments/service";
import { formatWon } from "../../../lib/products/format";

/**
 * 결제 완료.
 *
 * 조회만 하는 화면이다. 결제 확정은 `/api/payments/complete`가 이미 끝냈고,
 * 여기는 그 결과를 읽어 그린다. 그래서 새로고침하거나 뒤로 갔다 다시 와도
 * 결제가 다시 일어나지 않는다.
 *
 * 폼 폭(640)에서 멈춘다. 읽을 것이 네 줄뿐이라 800까지 늘리면 값들이 화면
 * 양 끝으로 갈라진다.
 */
export default async function PaymentCompletePage(
  props: PageProps<"/payments/[paymentId]">,
) {
  const { paymentId } = await props.params;
  const payment = await loadPayment(paymentId);

  return (
    <AppShell tabBar={false}>
      <PageContainer
        as="main"
        width="form"
        className="flex flex-col items-center gap-6 py-8 md:py-32"
      >
        <div
          // `background-success`는 green-50(옅은 배경)이다. 그 위의 글리프는
          // 같은 계열의 진한 색이어야 보인다 — `text-on-brand`(거의 흰색)를
          // 올리면 아무것도 안 보이는 원이 된다.
          className="flex shrink-0 items-center justify-center rounded-full bg-background-success text-text-success"
          style={{ width: 72, height: 72 }}
          aria-hidden
        >
          <Icon name="check" size={32} />
        </div>

        <header className="flex flex-col items-center gap-1.5">
          <h1 className="type-heading-lg text-center text-text-default md:type-display-sm">
            결제가 완료되었어요
          </h1>
          <p className="type-body-md text-center text-text-muted">
            자리를 확보했어요. 당일에 뵙겠습니다.
          </p>
        </header>

        <section
          aria-label="결제 정보"
          className="flex w-full flex-col gap-3 rounded-2xl border border-border-default bg-background-surface p-4"
        >
          <DetailRow label="상품">{payment.productName}</DetailRow>
          <DetailRow label="결제 금액" tone="text-text-brand">
            {formatWon(payment.amount)}
          </DetailRow>
          <DetailRow label="결제 일시">
            {formatPaymentDateTime(payment.paidAt)}
          </DetailRow>
          {/*
            주문번호는 포트원 결제 건 ID 그대로다. 문의할 때 이 값 하나로 건을
            찾을 수 있어야 해서 줄이거나 가공하지 않는다.
          */}
          <DetailRow label="주문번호">
            <span className="break-all">{payment.id}</span>
          </DetailRow>
        </section>

        <div className="flex w-full flex-col gap-2 md:flex-row md:justify-center">
          {payment.productId && (
            <ButtonLink
              href={`/products/${payment.productId}`}
              variant="secondary"
              size="lg"
              className="w-full md:w-auto"
            >
              상품 다시 보기
            </ButtonLink>
          )}
          <ButtonLink href="/products" size="lg" className="w-full md:w-auto">
            다른 모임 둘러보기
          </ButtonLink>
        </div>
      </PageContainer>
    </AppShell>
  );
}

/**
 * 남의 결제는 RLS가 걸러 `null`이 되고, 여기서 404가 된다.
 *
 * "권한 없음"과 "없는 주문"을 구분해 알려 주지 않는다. 구분하면 주문번호를
 * 넣어 보는 것만으로 그 번호가 실재하는지 알 수 있게 된다.
 *
 * 비로그인은 보통 여기까지 오지 않는다 — proxy가 `/payments/*`를 로그인 뒤로
 * 보낸다. 그래도 `UnauthorizedError`를 404로 받는 이유는, proxy의 검사와 이
 * 렌더 사이에 세션이 만료될 수 있어서다. 그 틈에 500을 띄우지 않는다.
 */
async function loadPayment(paymentId: string): Promise<PaymentDto> {
  try {
    return await getPayment(paymentId);
  } catch (reason) {
    if (reason instanceof NotFoundError || reason instanceof UnauthorizedError) {
      notFound();
    }
    throw reason;
  }
}
