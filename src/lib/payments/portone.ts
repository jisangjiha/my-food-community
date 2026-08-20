import "server-only";

import { PORTONE_API_BASE_URL, portoneApiSecret } from "./env";

/**
 * 포트원 V2 REST 클라이언트.
 *
 * 지금 필요한 것은 결제 단건 조회와 결제 취소 둘뿐이라 `@portone/server-sdk`의
 * REST 클라이언트를 넣지 않고 `fetch`로 부른다(웹훅 검증은 SDK를 쓴다). 이
 * 저장소는 네이버 API들도 같은 방식으로 부르고 있다.
 *
 * 인증 헤더는 `Bearer`가 아니라 `PortOne` 스킴이다. V2에서 권장하는 쪽이다.
 *
 * 이 파일은 HTTP만 안다. "이 결제가 우리 주문이 맞는가", "이 취소를 원장에
 * 적어도 되는가"는 `service.ts`가 판단한다.
 */

/**
 * 취소 내역 한 건. 결제 건 하나에 여러 개가 달릴 수 있다.
 *
 * 취소 원장의 멱등 키가 `transaction_key`가 아니라 이 `id`인 이유가 여기 있다 —
 * 그룹키만으로는 취소 행들을 서로 구분할 수 없다.
 */
export interface PortOneCancellation {
  /** 포트원이 채번한 취소 내역 아이디. */
  id: string;
  /**
   * `SUCCEEDED` | `FAILED` | `REQUESTED`.
   *
   * 카드 취소는 대체로 그 자리에서 `SUCCEEDED`지만, 취소가 비동기로 처리되는
   * PG는 `REQUESTED`를 거친다. 그 상태를 취소로 적으면 아직 돌려주지 않은 돈을
   * 돌려준 것으로 기록하게 된다.
   */
  status: string;
  /** 취소 금액. 원장에는 음수로 쌓지만 포트원은 양수로 준다. */
  totalAmount: number;
  reason?: string;
  /** ISO 8601. 취소가 끝난 시점. `REQUESTED` 상태에는 없다. */
  cancelledAt?: string;
  requestedAt?: string;
}

/** 조회 결과에서 우리가 실제로 보는 필드만 적는다. */
export interface PortOnePayment {
  /** 우리가 만든 결제 건 ID. 요청한 것과 같아야 한다. */
  id: string;
  /** `PAID`, `FAILED`, `CANCELLED`, `VIRTUAL_ACCOUNT_ISSUED` 등. */
  status: string;
  /** 포트원이 채번한 결제 시도 번호. UUID 형식이다. */
  transactionId?: string;
  orderName: string;
  currency: string;
  /** `total`은 취소해도 그대로다. 취소된 합계는 `cancelled`에 쌓인다. */
  amount: { total: number; cancelled?: number };
  channel?: { type?: string; key?: string; pgProvider?: string };
  /** 결제 요청 시 실어 보낸 값. 객체가 아니라 JSON 문자열로 온다. */
  customData?: string;
  /** ISO 8601. 결제 완료 상태에서만 있다. */
  paidAt?: string;
  method?: { type?: string };
  /** 취소 내역. 취소된 적이 없으면 없거나 빈 배열이다. */
  cancellations?: PortOneCancellation[];
  /** ISO 8601. 전액 취소된 건에만 있다. */
  cancelledAt?: string;
}

/**
 * 포트원 호출 자체가 실패했을 때.
 *
 * 검증에 실패한 것(`service.ts`의 판단)과 구분한다. 이쪽은 우리 잘못이거나
 * 포트원 장애라 사용자에게 할 말이 다르고, 재시도가 의미 있을 수도 있다.
 *
 * `status`에 포트원이 답한 상태 코드를 그대로 담는다. 부르는 쪽이 "없는 건
 * (404)"과 "이미 취소된 건(409)"과 "잠시 후 다시(그 외)"를 갈라야 하기 때문이다.
 */
export class PortOneApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PortOneApiError";
  }
}

/**
 * 결제 단건 조회. 그런 결제 건이 없으면 `null`.
 *
 * 결제창이 돌려준 결과도, 웹훅 본문도 그대로 믿지 않고 여기서 다시 묻는 것이
 * 결제 검증의 전부다. 금액·주문명·통화가 전부 우리 서버 바깥을 지나오기 때문이다.
 *
 * "없음"과 "묻지 못했음"을 구분해 돌려준다. 없는 건은 몇 번을 다시 물어도 없지만
 * (웹훅이라면 재시도할 이유가 없다), 조회 실패는 잠시 후 성공할 수 있다.
 *
 * 캐시하지 않는다(`cache: "no-store"`). 결제 상태는 조회할 때마다 달라질 수 있고,
 * 한 번 캐시된 `PAID`가 취소 후에도 남으면 취소된 건을 결제로 읽는다.
 */
export async function getPortOnePayment(
  paymentId: string,
): Promise<PortOnePayment | null> {
  const url = `${PORTONE_API_BASE_URL}/payments/${encodeURIComponent(paymentId)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `PortOne ${portoneApiSecret()}` },
      cache: "no-store",
    });
  } catch (reason) {
    console.error("[payments] 포트원 조회 요청 실패", reason);
    throw new PortOneApiError("결제 정보를 확인하지 못했습니다.", 502);
  }

  if (response.status === 404) {
    console.info(`[payments] 포트원에 없는 결제 건 paymentId=${paymentId}`);
    return null;
  }

  if (!response.ok) {
    // 본문에는 포트원 에러 코드가 들어 있다. 로그에만 남기고 밖으로는 내보내지
    // 않는다 — PG의 원본 에러는 우리 사용자에게 아무 의미가 없다.
    console.error(
      `[payments] 포트원 조회 실패 status=${response.status}`,
      await response.text().catch(() => ""),
    );
    throw new PortOneApiError("결제 정보를 확인하지 못했습니다.", 502);
  }

  return (await response.json()) as PortOnePayment;
}

/**
 * 결제 전액 취소.
 *
 * `amount`를 싣지 않으면 전액 취소다. 부분 취소는 아직 만들지 않는다 — 반쯤
 * 지원하는 취소 코드가 가장 위험하다.
 *
 * 이 함수가 성공했다는 것은 "포트원이 취소를 받아들였다"까지다. 그것을 원장에
 * 적어도 되는지는 `service.ts`가 결제 건을 **다시 조회해서** 판단한다. 바깥에서
 * 온 응답 하나로 돈이 오간 사실을 확정하지 않는다.
 */
export async function cancelPortOnePayment(
  paymentId: string,
  reason: string,
): Promise<PortOneCancellation> {
  const url = `${PORTONE_API_BASE_URL}/payments/${encodeURIComponent(paymentId)}/cancel`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `PortOne ${portoneApiSecret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
      cache: "no-store",
    });
  } catch (cause) {
    console.error("[payments] 포트원 취소 요청 실패", cause);
    throw new PortOneApiError("결제를 취소하지 못했습니다.", 502);
  }

  if (!response.ok) {
    /*
      404는 없는 결제 건, 409는 이미 취소되었거나 취소할 수 없는 상태
      (`PaymentAlreadyCancelledError`, `PaymentNotPaidError` 등)다. 상태 코드만
      올려 보내고 본문은 로그에 남긴다 — 포트원 에러 코드를 사용자에게 그대로
      보여 주지 않는다.
    */
    console.error(
      `[payments] 포트원 취소 실패 paymentId=${paymentId} status=${response.status}`,
      await response.text().catch(() => ""),
    );
    throw new PortOneApiError("결제를 취소하지 못했습니다.", response.status);
  }

  const body = (await response.json()) as { cancellation?: PortOneCancellation };
  if (!body.cancellation?.id) {
    console.error("[payments] 포트원 취소 응답에 취소 내역이 없습니다.", body);
    throw new PortOneApiError("결제를 취소하지 못했습니다.", 502);
  }

  return body.cancellation;
}
