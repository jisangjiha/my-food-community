import "server-only";

import { PORTONE_API_BASE_URL, portoneApiSecret } from "./env";

/**
 * 포트원 V2 REST 클라이언트.
 *
 * 지금 필요한 것은 결제 단건 조회 하나뿐이라 `@portone/server-sdk`를 넣지 않고
 * `fetch`로 부른다. 이 저장소는 네이버 API들도 같은 방식으로 부르고 있다.
 *
 * 인증 헤더는 `Bearer`가 아니라 `PortOne` 스킴이다. V2에서 권장하는 쪽이다.
 *
 * 이 파일은 HTTP만 안다. "이 결제가 우리 주문이 맞는가"는 `service.ts`가 판단한다.
 */

/** 조회 결과에서 우리가 실제로 보는 필드만 적는다. */
export interface PortOnePayment {
  /** 우리가 만든 결제 건 ID. 요청한 것과 같아야 한다. */
  id: string;
  /** `PAID`, `FAILED`, `VIRTUAL_ACCOUNT_ISSUED` 등. */
  status: string;
  /** 포트원이 채번한 결제 시도 번호. UUID 형식이다. */
  transactionId?: string;
  orderName: string;
  currency: string;
  amount: { total: number };
  channel?: { type?: string; key?: string; pgProvider?: string };
  /** 결제 요청 시 실어 보낸 값. 객체가 아니라 JSON 문자열로 온다. */
  customData?: string;
  /** ISO 8601. 결제 완료 상태에서만 있다. */
  paidAt?: string;
  method?: { type?: string };
}

/**
 * 포트원 호출 자체가 실패했을 때.
 *
 * 검증에 실패한 것(`service.ts`의 판단)과 구분한다. 이쪽은 우리 잘못이거나
 * 포트원 장애라 사용자에게 할 말이 다르고, 재시도가 의미 있을 수도 있다.
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
