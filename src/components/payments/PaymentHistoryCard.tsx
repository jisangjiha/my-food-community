import Link from "next/link";

import type { PaymentDto } from "../../lib/payments/dto";
import { formatPaymentDateTime } from "../../lib/payments/format";
import { formatWon } from "../../lib/products/format";
import { Badge } from "../ui/Badge";
import { CancelPaymentButton } from "./CancelPaymentButton";

/**
 * 결제 내역 한 장 — 마이 페이지 `결제 내역` 탭.
 *
 * 취소된 결제도 여기 남는다. 원장은 결제 행을 지우지 않으므로 "취소했으니
 * 결제 내역에서 사라진다"는 화면은 원장과 다른 이야기를 하게 된다. 대신 상태
 * 칩과 취소 금액 줄이 붙는다.
 *
 * 카드 전체를 링크로 만들지 않는다. 안에 취소 버튼이 있어서 링크 안에 버튼을
 * 넣는 마크업이 되고, 클릭이 양쪽으로 전달된다. 상품명만 링크로 둔다.
 */
export function PaymentHistoryCard({ payment }: { payment: PaymentDto }) {
  const canceled = payment.status === "canceled";

  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-border-default bg-background-surface p-3">
      <div className="flex items-start justify-between gap-1.5">
        {payment.productId ? (
          <Link
            href={`/products/${payment.productId}`}
            className="type-label-lg min-w-0 truncate text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
          >
            {payment.productName}
          </Link>
        ) : (
          // 상품이 지워졌다. 갈 곳이 없는 링크를 만들지 않는다.
          <span className="type-label-lg min-w-0 truncate text-text-muted">
            {payment.productName}
          </span>
        )}
        <Badge
          variant={canceled ? "neutral" : "brand"}
          tone="soft"
          size="lg"
        >
          {canceled ? "취소됨" : "결제 완료"}
        </Badge>
      </div>

      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="type-label-md text-text-muted">
          {formatPaymentDateTime(payment.paidAt)}
        </span>
        <span className="type-label-md text-text-muted">
          {formatWon(payment.amount)}
        </span>
        {canceled && (
          <span className="type-label-md text-text-muted">
            {`${formatWon(payment.canceledAmount)} 환불`}
          </span>
        )}
        {/*
          주문번호는 포트원 결제 건 ID 그대로다. 문의할 때 이 값 하나로 건을 찾을
          수 있어야 해서 줄이거나 가공하지 않는다.
        */}
        <span className="type-label-md break-all text-text-subtle">
          {`주문번호 ${payment.id}`}
        </span>
      </div>

      <div className="flex items-center justify-end">
        {canceled ? (
          <span className="type-label-md text-text-subtle">
            취소된 결제예요
          </span>
        ) : (
          <CancelPaymentButton
            paymentId={payment.id}
            productName={payment.productName}
            amount={payment.amount}
          />
        )}
      </div>
    </li>
  );
}
