import Link from "next/link";

import type { CancellationDto } from "../../lib/payments/dto";
import { formatPaymentDateTime } from "../../lib/payments/format";
import { formatWon } from "../../lib/products/format";
import { Badge } from "../ui/Badge";

/**
 * 취소 내역 한 장 — 마이 페이지 `취소 내역` 탭.
 *
 * 결제 건이 아니라 **원장의 취소 행 하나**를 그린다. 한 결제 건에 취소가 여러 번
 * 달릴 수 있어서(지금은 전액 취소만 하지만) 결제 단위로 묶으면 부분 취소를 붙이는
 * 날 목록의 뜻이 바뀐다.
 */
export function CancellationCard({
  cancellation,
}: {
  cancellation: CancellationDto;
}) {
  // 전액 취소만 만들지만, 원장은 부분 취소를 담을 수 있는 모양이다.
  const partial = cancellation.amount < cancellation.paymentAmount;

  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-border-default bg-background-surface p-3">
      <div className="flex items-start justify-between gap-1.5">
        {cancellation.productId ? (
          <Link
            href={`/products/${cancellation.productId}`}
            className="type-label-lg min-w-0 truncate text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
          >
            {cancellation.productName}
          </Link>
        ) : (
          <span className="type-label-lg min-w-0 truncate text-text-muted">
            {cancellation.productName}
          </span>
        )}
        <Badge variant="neutral" tone="soft" size="lg">
          {partial ? "부분 취소" : "전액 취소"}
        </Badge>
      </div>

      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="type-label-md text-text-brand">
          {`${formatWon(cancellation.amount)} 환불`}
        </span>
        <span className="type-label-md text-text-muted">
          {`결제 금액 ${formatWon(cancellation.paymentAmount)}`}
        </span>
        <span className="type-label-md text-text-muted">
          {formatPaymentDateTime(cancellation.canceledAt)}
        </span>
        <span className="type-label-md break-all text-text-subtle">
          {`주문번호 ${cancellation.paymentId}`}
        </span>
      </div>
    </li>
  );
}
