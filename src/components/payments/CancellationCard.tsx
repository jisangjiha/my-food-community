import Link from "next/link";

import type { PaymentDto } from "../../lib/payments/dto";
import {
  cancellationAmountLine,
  cancellationDateLine,
  cancellationRuleLine,
  refundBadge,
} from "../../lib/payments/format";
import { Badge } from "../ui/Badge";
import { Thumbnail } from "./PaymentHistoryCard";

/** 취소 내역 한 장 — design.pen `05c My Page - Cancellations`의 `cx-…` 카드. */
export function CancellationCard({ payment }: { payment: PaymentDto }) {
  const badge = refundBadge(payment);

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-border-default bg-background-surface p-3">
      <div className="flex gap-3">
        <Thumbnail
          imageUrl={payment.meeting.imageUrl}
          alt={payment.meeting.title}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="flex items-center justify-between gap-1.5">
            <Link
              href={`/meetings/${payment.meeting.id}`}
              className="type-label-lg min-w-0 truncate text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
            >
              {payment.meeting.title}
            </Link>
            <Badge variant={badge.variant} tone="soft" size="lg">
              {badge.label}
            </Badge>
          </div>
          <span className="type-label-md text-text-muted">
            {cancellationAmountLine(payment)}
          </span>
          <span className="type-label-md text-text-muted">
            {cancellationRuleLine(payment)}
          </span>
          <span className="type-label-md text-text-subtle">
            {cancellationDateLine(payment)}
          </span>
        </div>
      </div>
    </li>
  );
}
