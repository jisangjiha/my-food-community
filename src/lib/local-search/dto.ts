/**
 * 지역검색 결과 — 화면이 아는 유일한 모양.
 *
 * 네이버 응답 필드를 그대로 쓰지 않는다. `mapx`/`mapy`라는 이름은 x가 경도인지
 * 위도인지 매번 헷갈리게 만들고, 문자열이라 쓰는 쪽이 매번 파싱해야 한다.
 * 경계는 여기다.
 *
 * `id`를 두지 않는 이유: 네이버가 안정적인 식별자를 주지 않고, 화면 간 이동에
 * 필요한 것은 손잡이가 아니라 값 자체다.
 */
export interface LocalSearchResult {
  /** HTML 태그를 벗긴 상호명. */
  name: string;
  /** 지번 주소. 비어 있으면 도로명 주소가 들어온다. */
  address: string;
  /** 도로명 주소. 없으면 빈 문자열. */
  roadAddress: string;
  /** WGS84. 파싱이나 범위 검사에 실패하면 null. */
  lat: number | null;
  lng: number | null;
}
