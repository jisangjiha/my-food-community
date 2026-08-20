import {
  PaymentError,
  recordWebhookCancellation,
  recordWebhookPayment,
} from "@/lib/payments/service";
import {
  readPaymentWebhook,
  WebhookVerificationError,
} from "@/lib/payments/webhook";

/**
 * 포트원 웹훅 — 포트원 서버가 직접 부르는 자리. 결제와 취소가 같은 문으로 온다.
 *
 * 결제는 리다이렉트(`/api/payments/complete`)가 도달하지 못한 건을 건져 내고,
 * 취소는 우리 화면을 거치지 않은 취소(콘솔 취소, 기록에 실패한 취소, PG가
 * 비동기로 뒤늦게 끝낸 취소)를 건져 낸다. 어느 쪽이든 일은 이미 일어났고 그
 * 사실은 기록되어야 한다. 두 경로가 같은 건을 동시에 확정하려 들 수 있으므로
 * 기록은 멱등하다.
 *
 * `withRoute`로 감싸지 않는다. 그 래퍼는 사용자에게 보여 줄 JSON 에러를
 * 만들지만, 여기서 상태 코드는 사용자가 아니라 **포트원에게 하는 말**이다 —
 * "다시 보내라"인지 "그만 보내라"인지.
 *
 * 응답 규약:
 * - `400` 서명 검증 실패. 위조이거나 시크릿이 안 맞는다. 다시 받아도 같다.
 * - `200` 처리 끝. 또는 재시도해도 결과가 달라지지 않는 실패.
 * - `500` 일시적 실패. 포트원이 재전송한다(최대 5회, exponential backoff).
 *
 * 200을 돌려주기 전에 처리를 끝낸다. 먼저 200을 주고 뒤에서 처리하면, 그 처리가
 * 실패했을 때 재시도를 받을 방법이 없다.
 */
export async function POST(request: Request): Promise<Response> {
  /*
    본문은 반드시 원문 문자열로 읽는다. `request.json()`으로 파싱한 뒤 다시
    문자열로 만들면 공백과 키 순서가 달라져 서명이 깨진다.
  */
  const body = await request.text();

  let event;
  try {
    event = await readPaymentWebhook(body, request.headers);
  } catch (reason) {
    if (reason instanceof WebhookVerificationError) {
      console.error(`[payments] 웹훅 서명 검증 실패 reason=${reason.reason}`);
      return new Response(null, { status: 400 });
    }
    // 시크릿이 없거나 형식이 틀린 경우. 우리 설정 문제이므로 재전송을 받는다.
    console.error("[payments] 웹훅을 읽지 못했습니다.", reason);
    return new Response(null, { status: 500 });
  }

  /*
    모르는 이벤트는 조용히 200으로 닫는다. 포트원은 예고 없이 새 `type`을
    추가하고, 그때마다 500을 뱉으면 재전송이 다섯 번씩 몰린다.
  */
  if (event.kind === "ignored") {
    console.info(`[payments] 처리하지 않는 웹훅 type=${event.type}`);
    return new Response(null, { status: 200 });
  }

  try {
    if (event.kind === "paid") {
      await recordWebhookPayment(event.paymentId);
    } else {
      await recordWebhookCancellation(event.paymentId, event.cancellationId);
    }
  } catch (reason) {
    return failureResponse(event.paymentId, reason);
  }

  return new Response(null, { status: 200 });
}

/**
 * 실패를 "다시 보내라"와 "그만 보내라"로 가른다.
 *
 * 검증에서 어긋난 건(`mismatch`), 소유자를 알 수 없는 건(`unauthorized`), 이미
 * 취소로 처리된 건(`already_canceled`)은 몇 번을 다시 받아도 같은 결론이다.
 * 재전송을 받아 봐야 로그만 다섯 배가 된다.
 *
 * 반대로 승인이나 취소가 아직 안 끝났거나(`not_paid`·`not_canceled`) 포트원
 * 조회·DB 기록이 실패한 것은 잠시 후 성공할 수 있다. 이런 건 반드시 재전송을
 * 받아야 한다 — 여기서 놓치면 돈은 오갔는데 원장에는 없는 상태가 그대로 굳는다.
 */
function failureResponse(paymentId: string, reason: unknown): Response {
  if (
    reason instanceof PaymentError &&
    (reason.code === "mismatch" ||
      reason.code === "unauthorized" ||
      reason.code === "already_canceled")
  ) {
    console.error(
      `[payments] 웹훅 처리 중단 paymentId=${paymentId} code=${reason.code}`,
    );
    return new Response(null, { status: 200 });
  }

  console.error(`[payments] 웹훅 처리 실패 paymentId=${paymentId}`, reason);
  return new Response(null, { status: 500 });
}
