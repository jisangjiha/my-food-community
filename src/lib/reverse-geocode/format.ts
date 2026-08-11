/**
 * 네이버 리버스 지오코딩 응답에서 지번주소 한 줄을 만든다.
 *
 * 비밀 키를 모르는 계층이라 `server-only`를 붙이지 않는다. 순수 함수라
 * `npm run check:address`로 바로 돌려볼 수 있다 — `local-search/parse.ts`와
 * 같은 이유다.
 *
 * 응답 타입을 우리가 쓰는 필드로만 좁혀 적는다. `land.name`과
 * `addition0..4`는 도로명주소(`roadaddr`) 전용이라 없다.
 */

export interface NaverGeocodeArea {
  name?: string;
}

export interface NaverGeocodeRegion {
  area1?: NaverGeocodeArea;
  area2?: NaverGeocodeArea;
  area3?: NaverGeocodeArea;
  area4?: NaverGeocodeArea;
}

export interface NaverGeocodeLand {
  /** "1" 일반, "2" 임야. */
  type?: string;
  /** 본번. */
  number1?: string;
  /** 부번. 없으면 "" 또는 "0"으로 온다. */
  number2?: string;
}

export interface NaverGeocodeResult {
  region?: NaverGeocodeRegion;
  land?: NaverGeocodeLand;
}

/**
 * `서울특별시 성동구 성수동2가 315-7`
 *
 * 번지를 못 만들면 행정구역까지만, 그것도 없으면 `null`이다. 빈 문자열을
 * 주소인 척 돌려주지 않는다 — 카드가 아무 글자 없이 비어 조용한 실패가 된다.
 *
 * `area0`은 쓰지 않는다. 국가 코드("kr")라 주소에 넣을 것이 아니다.
 */
export function formatJibunAddress(
  result: NaverGeocodeResult | undefined,
): string | null {
  if (!result) return null;

  const region = result.region;
  const areas = [region?.area1, region?.area2, region?.area3, region?.area4]
    .map((area) => area?.name?.trim() ?? "")
    .filter((name) => name !== "");

  const landNumber = formatLandNumber(result.land);
  const parts = landNumber === "" ? areas : [...areas, landNumber];

  const joined = parts.join(" ");
  return joined === "" ? null : joined;
}

/** `315-7`, `315`, `산 12-3`. 본번이 없으면 빈 문자열. */
function formatLandNumber(land: NaverGeocodeLand | undefined): string {
  const number1 = land?.number1?.trim() ?? "";
  if (number1 === "") return "";

  const number2 = land?.number2?.trim() ?? "";
  // 임야는 지번 표기가 "산 12-3"이다.
  const prefix = land?.type === "2" ? "산 " : "";
  const sub = number2 !== "" && number2 !== "0" ? `-${number2}` : "";

  return `${prefix}${number1}${sub}`;
}
