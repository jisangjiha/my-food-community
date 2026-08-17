import Image from "next/image";
import Link from "next/link";

import {
  CANCEL_BLOCK_LABELS,
  cancelabilityOf,
  type PaymentDto,
} from "../../lib/payments/dto";
import {
  attendanceBadge,
  paymentAmountLine,
  paymentScheduleLine,
} from "../../lib/payments/format";
import { Icon } from "../foundation/Icon";
import { Badge } from "../ui/Badge";
import { ButtonLink } from "../ui/ButtonLink";

export interface PaymentHistoryCardProps {
  payment: PaymentDto;
  /** 취소 모달을 여는 경로. */
  cancelHref: string;
}

/**
 * 결제 내역 한 장 — design.pen `05b My Page - Payments`의 `pay-…` 카드.
 *
 * 카드 전체가 모임 상세로 가는 링크지만(PRD 309) 취소 버튼은 링크 안에 넣을 수
 * 없다. 제목만 링크로 두고 취소는 카드 아래 별도 줄에 놓는다.
 */
export function PaymentHistoryCard({
  payment,
  cancelHref,
}: PaymentHistoryCardProps) {
  const badge = attendanceBadge(payment);
  const { cancelable, blocked } = cancelabilityOf(payment);

  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-border-default bg-background-surface p-3">
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
            {paymentScheduleLine(payment)}
          </span>
          <span className="type-label-md text-text-muted">
            {paymentAmountLine(payment)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end">
        {cancelable ? (
          <ButtonLink
            href={cancelHref}
            variant="secondary"
            size="sm"
            scroll={false}
          >
            결제 취소
          </ButtonLink>
        ) : (
          <span className="type-label-md text-text-subtle">
            {blocked ? CANCEL_BLOCK_LABELS[blocked] : ""}
          </span>
        )}
      </div>
    </li>
  );
}

/** 56px 정사각 썸네일. 이미지가 없으면 시안처럼 아이콘 자리표시자를 그린다. */
export function Thumbnail({
  imageUrl,
  alt,
}: {
  imageUrl: string | null;
  alt: string;
}) {
  if (!imageUrl) {
    return (
      <span
        className="flex size-14 shrink-0 items-center justify-center rounded-[10px] bg-background-brand-subtle text-text-subtle"
        aria-hidden
      >
        <Icon name="image" size={24} />
      </span>
    );
  }

  return (
    <span className="relative size-14 shrink-0 overflow-hidden rounded-[10px]">
      <Image
        src={imageUrl}
        alt={alt}
        fill
        sizes="56px"
        className="object-cover"
      />
    </span>
  );
}
