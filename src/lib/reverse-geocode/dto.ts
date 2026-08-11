/**
 * 리버스 지오코딩 결과 — 화면이 아는 유일한 모양.
 *
 * `region`/`land` 원본을 내려보내지 않는다. 화면이 쓰는 것은 문자열 한 줄이고,
 * 네이버 응답 구조를 UI가 알게 되면 그건 스키마가 새어 나간 것이다.
 */
export interface ReverseGeocodeResult {
  /** 조립한 지번주소. 좌표는 유효하나 주소를 못 찾으면 null. */
  address: string | null;
}
