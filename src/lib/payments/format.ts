import type { BadgeVariant } from "../../components/ui/Badge";
import {
  formatMeetingShort,
  formatMonthDay,
  formatWon,
} from "../meetings/format";
import {
  attendanceStateOf,
  refundStateOf,
  type AttendanceState,
  type PaymentDto,
  type RefundState,
} from "./dto";
import { refundRuleByKey, refundRuleLabel } from "./refund";

/**
 * 결제·취소 내역 카드의 문구.
 *
 * 서버 전용이 아니다. 카드는 서버 컴포넌트지만 모달(클라이언트)도 같은 문구를 쓴다.
 */

/** `12/14 토 14:00 · 2명`. */
export function paymentScheduleLine(payment: PaymentDto): string {
  return `${formatMeetingShort(payment.meeting.startsAt)} · ${payment.headcount}명`;
}

/** `50,000원 · 12/13 결제`. */
export function paymentAmountLine(payment: PaymentDto): string {
  return `${formatWon(payment.amount)} · ${formatMonthDay(payment.paidAt)} 결제`;
}

/** `결제 30,000원 · 환불 30,000원`. */
export function cancellationAmountLine(payment: PaymentDto): string {
  return `결제 ${formatWon(payment.amount)} · 환불 ${formatWon(payment.refundAmount ?? 0)}`;
}

/**
 * `적용 규정: 모임 3~7일 전 (50%)`.
 *
 * 저장된 규정 키로 문구를 다시 만든다. 시안은 이 자리에만 `3~7일 전 취소` 표현을
 * 쓰지만, 네 화면이 같은 문구를 써야 하므로 규정 표와 같은 표현으로 통일한다.
 */
export function cancellationRuleLine(payment: PaymentDto): string {
  if (!payment.refundRule) return "적용 규정 확인 중";
  return `적용 규정: ${refundRuleLabel(refundRuleByKey(payment.refundRule))}`;
}

/** `12/05 취소`. */
export function cancellationDateLine(payment: PaymentDto): string {
  return payment.canceledAt ? `${formatMonthDay(payment.canceledAt)} 취소` : "";
}

export interface StatusBadge {
  label: string;
  variant: BadgeVariant;
}

const ATTENDANCE_BADGES: Record<AttendanceState, StatusBadge> = {
  upcoming: { label: "참여 예정", variant: "brand" },
  done: { label: "참여 완료", variant: "neutral" },
};

const REFUND_BADGES: Record<RefundState, StatusBadge> = {
  processing: { label: "환불 처리 중", variant: "warning" },
  done: { label: "환불 완료", variant: "success" },
};

export function attendanceBadge(payment: PaymentDto, now?: Date): StatusBadge {
  return ATTENDANCE_BADGES[attendanceStateOf(payment, now)];
}

export function refundBadge(payment: PaymentDto, now?: Date): StatusBadge {
  return REFUND_BADGES[refundStateOf(payment, now)];
}

/** 취소 내역 탭 상단 고정 안내(PRD 324). */
export const REFUND_DELAY_NOTE =
  "카드 환불은 카드사 사정으로 3~5일 걸릴 수 있어요.";
