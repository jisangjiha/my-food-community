import { refundPlanFor, type RefundPlan, type RefundRuleKey } from "./refund";

/**
 * 결제 DTO — BFF가 화면으로 내려보내는 유일한 모양.
 *
 * 서버 전용이 아니다. 시트와 취소 모달(클라이언트)이 타입을 쓴다.
 *
 * 취소 관련 값들은 `status === "canceled"`일 때만 채워진다. DB에도 같은 조건이
 * 체크 제약으로 들어 있어, 반쪽만 채워진 행은 애초에 저장되지 않는다.
 */
export interface PaymentDto {
  id: string;
  /** 사용자에게 보여 주는 식별자. 결제 완료 화면이 이걸로 조회한다. */
  orderNo: string;
  headcount: number;
  amount: number;
  method: string;
  status: "paid" | "canceled";
  paidAt: string;
  canceledAt: string | null;
  refundAmount: number | null;
  refundRate: number | null;
  refundRule: RefundRuleKey | null;
  refundCompletesAt: string | null;
  meeting: {
    id: string;
    title: string;
    startsAt: string;
    address: string;
    imageUrl: string | null;
  };
}

/**
 * 아래 파생 함수들이 여기 있는 이유: 화면마다 `startsAt > now`를 다시 비교하면
 * 한 곳만 규칙이 바뀌는 날이 온다. 배지·버튼·모달이 같은 판단을 공유한다.
 */

/** 결제 내역 배지 — 모임이 아직 안 열렸으면 `참여 예정`, 지났으면 `참여 완료`. */
export type AttendanceState = "upcoming" | "done";

export function attendanceStateOf(
  payment: PaymentDto,
  now: Date = new Date(),
): AttendanceState {
  return new Date(payment.meeting.startsAt) > now ? "upcoming" : "done";
}

/**
 * 취소 내역 배지.
 *
 * 모의 결제라 환불이 즉시 끝나지만, 그러면 `환불 처리 중`이 화면에 영원히 나타나지
 * 않고 "카드 환불은 3~5일 걸릴 수 있어요" 안내가 거짓이 된다. 취소할 때 적어 둔
 * 완료 예정 시각(취소 + 3일)을 지나면 완료로 읽는다.
 */
export type RefundState = "processing" | "done";

export function refundStateOf(
  payment: PaymentDto,
  now: Date = new Date(),
): RefundState {
  if (!payment.refundCompletesAt) return "done";
  return new Date(payment.refundCompletesAt) <= now ? "done" : "processing";
}

/** 취소 버튼을 못 내보내는 사유(PRD 310). */
export type CancelBlock = "ended" | "no_refund";

export interface Cancelability {
  cancelable: boolean;
  blocked: CancelBlock | null;
  /** 지금 취소하면 적용될 규정과 환불액. 서버 시각 기준. */
  plan: RefundPlan;
}

export function cancelabilityOf(
  payment: PaymentDto,
  now: Date = new Date(),
): Cancelability {
  const plan = refundPlanFor(payment.amount, payment.meeting.startsAt, now);

  if (new Date(payment.meeting.startsAt) <= now) {
    return { cancelable: false, blocked: "ended", plan };
  }
  if (plan.rule.rate === 0) {
    return { cancelable: false, blocked: "no_refund", plan };
  }
  return { cancelable: true, blocked: null, plan };
}

export const CANCEL_BLOCK_LABELS: Record<CancelBlock, string> = {
  ended: "종료된 모임",
  no_refund: "환불 기간 종료",
};
