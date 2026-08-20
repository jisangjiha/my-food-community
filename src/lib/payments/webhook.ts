import "server-only";

import * as PortOneWebhook from "@portone/server-sdk/webhook";

import { portoneWebhookSecret } from "./env";

/**
 * 포트원 웹훅 수신의 첫 관문 — 서명 검증과 이벤트 분류.
 *
 * 웹훅 주소는 공개된 URL이다. 누구나 "결제가 완료되었다"는 본문을 만들어 보낼
 * 수 있으므로, **검증을 통과하기 전에는 본문의 어떤 값도 신뢰하지 않는다.**
 * 검증은 Standard Webhooks 스펙을 따르며, 포트원 서버 SDK가 그것을 구현한다.
 *
 * 검증을 통과한 뒤에도 본문이 말하는 "무슨 일이 있었는지"는 믿지 않는다. 웹훅이
 * 알려 주는 것은 `paymentId`까지이고, 상태는 결제 조회 API로 다시 확인한다
 * (`service.ts`의 `verifyPaidPayment`).
 *
 * 이 파일은 서명과 이벤트 종류만 안다. 결제 검증과 기록은 `service.ts`가 한다.
 */

/**
 * 우리가 처리하는 웹훅 이벤트.
 *
 * 포트원은 예고 없이 새 `type`을 추가한다. 모르는 이벤트를 에러로 만들면 그때마다
 * 500을 뱉고 포트원이 다섯 번 재시도한다. 그래서 아는 것만 좁혀 담고 나머지는
 * `ignored`로 흘린다.
 */
export type PaymentWebhookEvent =
  | { kind: "paid"; paymentId: string }
  | { kind: "ignored"; type: string };

/**
 * 서명을 검증하고 이벤트를 가른다. 검증 실패는 그대로 던진다.
 *
 * `body`는 반드시 **원문 문자열**이어야 한다. JSON으로 파싱한 뒤 다시 문자열로
 * 만들면 공백과 키 순서가 달라져 서명이 깨진다. 라우트에서 `request.text()`로
 * 읽어 그대로 넘긴다.
 */
export async function readPaymentWebhook(
  body: string,
  headers: Headers,
): Promise<PaymentWebhookEvent> {
  const webhook = await PortOneWebhook.verify(
    portoneWebhookSecret(),
    body,
    // SDK는 express의 `req.headers`(평범한 객체)를 기대한다. `Headers`는
    // 그 모양이 아니므로 펼쳐서 넘긴다. 검증에 쓰이는 세 헤더
    // (webhook-id / webhook-timestamp / webhook-signature)는 값이 하나뿐이라
    // 이 변환에서 잃는 것이 없다.
    Object.fromEntries(headers),
  );

  /*
    결제 취소 웹훅(`Transaction.Cancelled` / `Transaction.PartialCancelled`)은
    아직 처리하지 않는다. 취소 원장 행을 쓰는 경로가 아직 없기 때문이다.
    여기서 `kind`를 하나 늘리고 `service.ts`에 기록 함수를 붙이면 된다.

    가상계좌 발급(`Transaction.VirtualAccountIssued`)도 범위 밖이다. 돈이 아직
    들어오지 않은 상태라 결제로 적으면 안 된다.
  */
  if (webhook.type === "Transaction.Paid") {
    return { kind: "paid", paymentId: webhook.data.paymentId };
  }

  return { kind: "ignored", type: String(webhook.type) };
}

/**
 * 서명 검증 실패. 라우트가 이것만 400으로 끊는다.
 *
 * SDK 타입을 라우트로 새어 나가게 하지 않으려고 여기서 한 번 거쳐 내보낸다 —
 * 포트원을 아는 코드의 경계를 `payments/*`에 두는 규칙 그대로다.
 */
export const WebhookVerificationError = PortOneWebhook.WebhookVerificationError;
