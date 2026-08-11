/**
 * 화면에 쓰는 표기 변환.
 *
 * 서버 전용이 아니다. 목록 카드와 상세가 같은 날짜 모양을 써야 해서 한 곳에 둔다.
 * 두 화면이 각자 포맷을 들고 있으면 한쪽만 바뀌는 날이 온다.
 */

/** design.pen의 "25.12.10" 형식. */
export function formatPlaceDate(iso: string): string {
  const date = new Date(iso);
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}
