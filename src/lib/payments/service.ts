import "server-only";

import { NotFoundError } from "@/lib/api/http";
import { createClient } from "@/lib/supabase/server";

import type { PaymentDto } from "./dto";
import type { RefundRuleKey } from "./refund";

/**
 * 결제 데이터 접근 계층.
 *
 * Supabase를 아는 코드는 여기까지다. 화면은 DTO만 받는다.
 *
 * RLS가 자기 행만 보여 주므로 `user_id` 조건은 방어용이다. 정책이 느슨해지는 날
 * 조용히 남의 결제를 세지 않도록 읽는 쪽 코드에도 조건을 남긴다.
 */

/** `pay_meeting`·`cancel_payment`가 던지는 사유. */
export type PaymentErrorCode =
  | "AUTH_REQUIRED"
  | "NOT_FOUND"
  | "CLOSED"
  | "HEADCOUNT"
  | "ALREADY_PAID"
  | "SOLD_OUT"
  | "ALREADY_CANCELED"
  | "NO_REFUND"
  | "BAD_REFUND"
  | "UNKNOWN";

/** 사유 코드를 들고 다니는 예외. 화면 문구는 서버 액션이 붙인다. */
export class PaymentError extends Error {
  constructor(
    readonly code: PaymentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

const KNOWN_CODES: PaymentErrorCode[] = [
  "AUTH_REQUIRED",
  "NOT_FOUND",
  "CLOSED",
  "HEADCOUNT",
  "ALREADY_PAID",
  "SOLD_OUT",
  "ALREADY_CANCELED",
  "NO_REFUND",
  "BAD_REFUND",
];

/**
 * Postgres 예외를 코드로 옮긴다.
 *
 * 함수는 `raise exception 'SOLD_OUT'`처럼 사유 한 단어만 던진다. 유니크 인덱스에
 * 걸린 경우(23505)는 같은 사람이 같은 모임을 두 번 결제한 것이므로 ALREADY_PAID와
 * 같은 사실이다 — 함수의 exists 검사와 인덱스 사이의 경합에서만 나온다.
 */
function toPaymentError(error: {
  message?: string;
  code?: string;
}): PaymentError {
  if (error.code === "23505") {
    return new PaymentError("ALREADY_PAID", "이미 결제한 모임입니다.");
  }
  const found = KNOWN_CODES.find((code) => error.message?.includes(code));
  return new PaymentError(
    found ?? "UNKNOWN",
    error.message ?? "결제에 실패했습니다.",
  );
}

/**
 * 이 사용자가 이 모임을 이미 결제했는지. 결제한 건의 id, 없으면 null.
 *
 * 상세 화면의 CTA가 `결제 내역 보기`로 바뀌는 조건이다(PRD 275). DB에도 같은
 * 사실이 `(user_id, meeting_id) where status='paid'` 유니크 인덱스로 들어 있다.
 */
export async function findPaidPaymentId(
  meetingId: string,
  userId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment")
    .select("id")
    .eq("meeting_id", meetingId)
    .eq("user_id", userId)
    .eq("status", "paid")
    .maybeSingle();

  if (error) {
    console.error("[payments] 결제 여부 조회 실패", error);
    throw new Error("결제 정보를 불러오지 못했습니다.");
  }

  return data?.id ?? null;
}

/**
 * 결제한다. 주문번호를 돌려준다.
 *
 * 정원 검사와 총액 계산은 `pay_meeting`이 트랜잭션 안에서 한다. 여기서 금액을
 * 계산해 넘기지 않는다 — 화면에 보인 금액과 청구액이 어긋날 방법을 남기지 않는다.
 */
export async function createPayment(
  meetingId: string,
  headcount: number,
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("pay_meeting", {
    p_meeting_id: meetingId,
    p_headcount: headcount,
  });

  if (error) {
    console.error("[payments] 결제 실패", error);
    throw toPaymentError(error);
  }
  if (typeof data !== "string" || data.length === 0) {
    throw new PaymentError("UNKNOWN", "결제 결과를 확인하지 못했습니다.");
  }

  return data;
}

const PAYMENT_SELECT =
  "id, order_no, headcount, amount, method, status, paid_at, canceled_at, refund_amount, refund_rate, refund_rule, refund_completes_at, meeting(id, title, starts_at, address, image_url)";

interface PaymentRow {
  id: string;
  order_no: string;
  headcount: number;
  amount: number;
  method: string;
  status: string;
  paid_at: string;
  canceled_at: string | null;
  refund_amount: number | null;
  refund_rate: number | null;
  refund_rule: string | null;
  refund_completes_at: string | null;
  meeting: {
    id: string;
    title: string;
    starts_at: string;
    address: string;
    image_url: string | null;
  } | null;
}

function toPaymentDto(row: PaymentRow): PaymentDto {
  if (!row.meeting) {
    // 모임 참조는 NOT NULL이고 삭제 경로가 없다. 여기 오면 스키마가 바뀐 것이다.
    throw new Error("결제에 연결된 모임이 없습니다.");
  }

  return {
    id: row.id,
    orderNo: row.order_no,
    headcount: row.headcount,
    amount: row.amount,
    method: row.method,
    status: row.status === "canceled" ? "canceled" : "paid",
    paidAt: row.paid_at,
    canceledAt: row.canceled_at,
    refundAmount: row.refund_amount,
    refundRate: row.refund_rate,
    refundRule: (row.refund_rule as RefundRuleKey | null) ?? null,
    refundCompletesAt: row.refund_completes_at,
    meeting: {
      id: row.meeting.id,
      title: row.meeting.title,
      startsAt: row.meeting.starts_at,
      address: row.meeting.address,
      imageUrl: row.meeting.image_url,
    },
  };
}

/**
 * 주문번호로 한 건.
 *
 * 남의 주문번호를 넣으면 RLS가 걸러 `NotFoundError`가 된다. "권한 없음"과 "없는
 * 주문"을 구분해 알려 주면 주문번호의 존재 여부가 샌다.
 */
export async function getPaymentByOrderNo(
  orderNo: string,
  userId: string,
): Promise<PaymentDto> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment")
    .select(PAYMENT_SELECT)
    .eq("order_no", orderNo)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[payments] 주문 조회 실패", error);
    throw new Error("결제 정보를 불러오지 못했습니다.");
  }
  if (!data) {
    throw new NotFoundError("결제 내역을 찾을 수 없습니다.");
  }

  return toPaymentDto(data as unknown as PaymentRow);
}
