/**
 * 네이버 지역검색 응답의 지저분한 부분을 정리하는 순수 함수들.
 *
 * 비밀 키를 모르는 계층이라 `server-only`를 붙이지 않는다. 등록 화면이 URL
 * 쿼리로 받은 좌표를 검증할 때도 같은 잣대를 써야 하므로 공유한다.
 */

/** 대한민국 대략 경계. 좌표 파싱이 틀렸는지 가리는 체. */
export const KOREA_BOUNDS = {
  minLat: 33,
  maxLat: 39,
  minLng: 124,
  maxLng: 132,
} as const;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/**
 * 상호명에서 HTML을 걷어낸다.
 *
 * 네이버는 검색어를 `<b>오월</b>식당`처럼 감싸서 돌려준다. React가 문자열을
 * 이스케이프하므로 XSS는 아니지만, 그대로 두면 화면에 `<b>`가 글자로 보인다.
 */
export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .trim();
}

/**
 * 좌표 문자열을 도(degree)로. 못 믿을 값이면 null.
 *
 * 문서가 `mapx`/`mapy`를 "WGS84"라고만 하고 자릿수 예시를 플레이스홀더로 남겨
 * 뒀다. 네이버 검색 API는 역사적으로 도×10^7 정수 문자열("1270276240")을
 * 돌려줬으므로 둘 다 받는다.
 *
 * 범위 검사가 핵심이다. 나누기를 잘못하면 지도가 아프리카 앞바다를 자신 있게
 * 가리키는데, 그건 아무도 눈치채지 못하는 조용한 실패다.
 */
export function toDegrees(
  raw: string | undefined,
  min: number,
  max: number,
): number | null {
  if (raw === undefined || raw.trim() === "") return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed === 0) return null;

  const degrees = Math.abs(parsed) > 1000 ? parsed / 1e7 : parsed;
  if (degrees < min || degrees > max) return null;

  return degrees;
}

/**
 * URL 쿼리로 받은 위도·경도 한 쌍. 둘 다 성해야 좌표로 인정한다.
 *
 * 하나만 맞는 좌표는 좌표가 아니다. 반쪽만 반영하면 지도가 엉뚱한 자오선
 * 위를 가리킨다.
 */
export function parseLatLng(
  rawLat: unknown,
  rawLng: unknown,
): { lat: number; lng: number } | null {
  if (typeof rawLat !== "string" || typeof rawLng !== "string") return null;

  const lat = toDegrees(rawLat, KOREA_BOUNDS.minLat, KOREA_BOUNDS.maxLat);
  const lng = toDegrees(rawLng, KOREA_BOUNDS.minLng, KOREA_BOUNDS.maxLng);
  if (lat === null || lng === null) return null;

  return { lat, lng };
}
