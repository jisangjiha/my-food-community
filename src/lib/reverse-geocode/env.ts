import "server-only";

/**
 * 네이버 리버스 지오코딩 자격 증명. 서버에서만 읽힌다.
 *
 * 지도 키(`NAVER_MAP_CLIENT_ID`)와도, 지역검색 키(`NAVER_SEARCH_*`)와도 다르다.
 * 호스트부터 다르다 — 이쪽은 `maps.apigw.ntruss.com`이다.
 *
 * `local-search/env.ts`와 같이 모듈 최상단이 아니라 함수로 감싼다. 최상단에서
 * 던지면 키가 없는 환경에서 `next build`가 이 모듈을 훑는 것만으로 실패한다.
 * 지연시키면 실제로 조회할 때만 터진다 — 고쳐야 할 시점에 정확히.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `환경변수 ${name}가 없습니다. .env.example을 참고해 .env.local에 추가하세요.`,
    );
  }
  return value;
}

export function naverGeocodeCredentials(): {
  apiKeyId: string;
  apiKey: string;
} {
  return {
    apiKeyId: required(
      "NAVER_GEOCODE_API_KEY_ID",
      process.env.NAVER_GEOCODE_API_KEY_ID,
    ),
    apiKey: required("NAVER_GEOCODE_API_KEY", process.env.NAVER_GEOCODE_API_KEY),
  };
}
