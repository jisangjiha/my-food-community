/**
 * 포트원(PortOne) V2 접속 정보.
 *
 * 값 셋의 성격이 서로 다르다.
 *
 * - `PORTONE_STORE_ID`·`PORTONE_CHANNEL_KEY`는 결제창을 여는 데 필요해 어차피
 *   브라우저에 보인다. 비밀값이 아니다. 그런데도 `NEXT_PUBLIC_`을 붙이지 않는
 *   이유는 `maps/env.ts`와 같다 — 접두사를 빼 두면 Next.js가 아무 클라이언트
 *   번들에나 값을 인라인하지 않으므로, 값이 나가는 지점이 상품 상세 한 곳으로
 *   좁혀진다. 실제 방어선은 포트원 콘솔의 결제 검증과 서버 재조회다.
 * - `PORTONE_API_SECRET`은 진짜 비밀값이다. 이 값이 있으면 아무 결제 건이나
 *   조회하고 취소할 수 있다. 브라우저로 절대 내보내지 않는다.
 *
 * 없을 때의 태도도 다르다. 결제창 키가 없으면 상품 상세는 그대로 보이되 결제
 * 버튼만 잠긴다(그래서 `null`을 돌려준다). API 시크릿이 없으면 결제 완료 검증
 * 자체가 성립하지 않으므로 그 자리에서 던진다 — 검증 없이 결제를 기록하느니
 * 500이 낫다.
 */

/** 포트원 REST API 주소. 문서상 고정값이라 환경변수로 빼지 않는다. */
export const PORTONE_API_BASE_URL = "https://api.portone.io";

export interface PortOneCheckoutKeys {
  storeId: string;
  channelKey: string;
}

/**
 * 결제창을 여는 데 필요한 공개 키 두 개. 하나라도 없으면 `null`.
 *
 * 한쪽만 있는 상태를 통과시키지 않는다. 그 조합으로 결제창을 열면 포트원이
 * 거절하고, 사용자는 버튼을 눌렀는데 아무 일도 일어나지 않는 화면을 본다.
 */
export function portoneCheckoutKeys(): PortOneCheckoutKeys | null {
  const storeId = process.env.PORTONE_STORE_ID;
  const channelKey = process.env.PORTONE_CHANNEL_KEY;

  if (!storeId || !channelKey) return null;

  return { storeId, channelKey };
}

/**
 * V2 API 시크릿. 포트원 콘솔 > 결제연동 탭에서 발급한다.
 *
 * `supabase/env.ts`처럼 모듈 최상단에서 읽지 않고 함수로 감싼다. 최상단에서
 * 던지면 값이 없는 환경에서 `next build`가 이 모듈을 훑는 것만으로 실패한다.
 */
export function portoneApiSecret(): string {
  const value = process.env.PORTONE_API_SECRET;
  if (!value) {
    throw new Error(
      "환경변수 PORTONE_API_SECRET가 없습니다. .env.example을 참고해 .env.local에 추가하세요.",
    );
  }
  return value;
}

/**
 * 웹훅 시크릿. 포트원 콘솔 > 결제연동 > 결제알림(Webhook) 관리에서 발급한다.
 *
 * API 시크릿과 다른 값이다. 이쪽은 포트원이 보낸 요청이 맞는지 확인하는 데만
 * 쓰이고, 이 값으로 결제를 조회하거나 취소할 수는 없다. 그래도 비밀값이다 —
 * 새어 나가면 아무나 결제 완료 웹훅을 위조해 보낼 수 있다.
 *
 * 없으면 그 자리에서 던진다. 검증 없이 웹훅을 처리하느니 500이 낫고, 500이면
 * 포트원이 재전송하므로 값을 채운 뒤 밀린 웹훅이 다시 들어온다.
 */
export function portoneWebhookSecret(): string {
  const value = process.env.PORTONE_WEBHOOK_SECRET;
  if (!value) {
    throw new Error(
      "환경변수 PORTONE_WEBHOOK_SECRET가 없습니다. .env.example을 참고해 .env.local에 추가하세요.",
    );
  }
  return value;
}
