import "server-only";

/**
 * 네이버 지역검색 API 자격 증명. 서버에서만 읽힌다.
 *
 * 지도 키(`NAVER_MAP_CLIENT_ID`)와 다르다. 그건 스크립트 URL에 실려 브라우저로
 * 나가는 값이라 비밀이 아니지만, 이 둘은 진짜 비밀값이다. `server-only`가
 * 클라이언트 번들로 새는 길을 빌드 단계에서 끊는다.
 *
 * `supabase/env.ts`와 달리 모듈 최상단에서 읽지 않고 함수로 감싼다. 최상단에서
 * 던지면 키가 없는 환경에서 `next build`가 이 모듈을 훑는 것만으로 실패한다.
 * 지연시키면 실제로 검색을 시도할 때만 터진다 — 고쳐야 할 시점에 정확히.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `환경변수 ${name}가 없습니다. .env.example을 참고해 .env.local에 추가하세요.`,
    );
  }
  return value;
}

export function naverSearchCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  return {
    clientId: required(
      "NAVER_SEARCH_CLIENT_ID",
      process.env.NAVER_SEARCH_CLIENT_ID,
    ),
    clientSecret: required(
      "NAVER_SEARCH_CLIENT_SECRET",
      process.env.NAVER_SEARCH_CLIENT_SECRET,
    ),
  };
}
