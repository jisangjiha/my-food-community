"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { NotFoundError } from "@/lib/api/http";
import { getCurrentUser } from "@/lib/auth/session";

import { refundPlanFor } from "./refund";
import {
  applyCancellation,
  createPayment,
  getMyPayment,
  PaymentError,
  type PaymentErrorCode,
} from "./service";

/**
 * 결제·취소 서버 액션.
 *
 * 변경은 Route Handler가 아니라 액션으로 한다. 화면이 폼 하나로 끝나고, Next.js가
 * CSRF 토큰을 붙여 준다.
 */

export interface PayFormState {
  error?: string;
}

/** 사유 코드를 사용자 문구로. Supabase 원본 메시지는 로그에만 남는다. */
const PAY_MESSAGES: Record<PaymentErrorCode, string> = {
  AUTH_REQUIRED: "로그인이 필요합니다. 다시 로그인해 주세요.",
  NOT_FOUND: "모임을 찾을 수 없어요.",
  CLOSED: "모집이 종료되었어요.",
  HEADCOUNT: "신청 가능한 인원을 확인해 주세요.",
  ALREADY_PAID:
    "이미 결제한 모임이에요. 마이 페이지 > 결제 내역에서 확인할 수 있어요.",
  SOLD_OUT: "결제 중 자리가 마감되었어요.",
  ALREADY_CANCELED: "이미 취소된 결제예요.",
  NO_REFUND: "환불 가능 기간이 지났어요.",
  BAD_REFUND: "환불 금액을 다시 계산해야 해요. 잠시 후 다시 시도해 주세요.",
  UNKNOWN: "결제에 실패했어요. 잠시 후 다시 시도해 주세요.",
};

export async function payMeeting(
  _previous: PayFormState,
  formData: FormData,
): Promise<PayFormState> {
  const meetingId = String(formData.get("meetingId") ?? "");
  const headcount = Number(formData.get("headcount") ?? 0);
  const agreed = formData.get("agreed") === "on";

  if (!meetingId) return { error: PAY_MESSAGES.NOT_FOUND };
  if (!Number.isInteger(headcount) || headcount < 1) {
    return { error: PAY_MESSAGES.HEADCOUNT };
  }
  // 체크박스는 화면에서도 버튼을 막지만, 폼은 직접 전송될 수 있다.
  if (!agreed) return { error: "환불 규정 확인에 동의해 주세요." };

  // 비로그인이면 시트가 아니라 로그인으로 보낸다. 돌아올 곳은 시트가 열린 상세다.
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/meetings/${meetingId}?pay=1`)}`,
    );
  }

  let orderNo: string;
  try {
    orderNo = await createPayment(meetingId, headcount);
  } catch (reason) {
    if (reason instanceof PaymentError) {
      return { error: PAY_MESSAGES[reason.code] };
    }
    throw reason;
  }

  // 남은 자리가 줄었다. 배너·상세가 캐시된 수를 보여 주면 다음 사람이 마감된
  // 모임을 결제하려 든다.
  revalidatePath("/");
  revalidatePath(`/meetings/${meetingId}`);

  // redirect는 예외를 던진다. try 밖에서 불러야 위 catch에 걸리지 않는다.
  redirect(`/payments/${orderNo}`);
}

/**
 * 결제를 취소한다.
 *
 * 환불 금액은 클라이언트가 보낸 값을 쓰지 않는다. 여기서 서버 시각으로 다시
 * 계산하고, 모달이 보여 준 금액은 표시용이다(PRD 374).
 */
export async function cancelPayment(
  _previous: PayFormState,
  formData: FormData,
): Promise<PayFormState> {
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) return { error: PAY_MESSAGES.NOT_FOUND };

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/my?tab=payments")}`);
  }

  let meetingId: string;
  try {
    const payment = await getMyPayment(paymentId, user.id);
    meetingId = payment.meeting.id;

    if (payment.status !== "paid") {
      return { error: PAY_MESSAGES.ALREADY_CANCELED };
    }

    const plan = refundPlanFor(payment.amount, payment.meeting.startsAt);
    if (plan.rule.rate === 0) return { error: PAY_MESSAGES.NO_REFUND };

    await applyCancellation(paymentId, plan);
  } catch (reason) {
    if (reason instanceof PaymentError) {
      return { error: PAY_MESSAGES[reason.code] };
    }
    if (reason instanceof NotFoundError) {
      return { error: PAY_MESSAGES.NOT_FOUND };
    }
    throw reason;
  }

  // 자리가 하나 돌아왔다. 배너와 상세의 남은 자리가 그대로면 마감된 것처럼 보인다.
  revalidatePath("/");
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/my");

  redirect("/my?tab=cancels");
}
