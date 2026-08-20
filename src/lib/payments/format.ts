/**
 * 결제 화면의 일시 표기.
 *
 * 금액은 `products/format.ts`의 `formatWon`을 그대로 쓴다. 같은 금액이 상품
 * 상세와 결제 완료에서 다르게 보이면 사용자는 둘 중 무엇이 맞는지 알 수 없다.
 *
 * 날짜 표기는 상품 쪽과 일부러 다르다. 상품의 `8월 29일 (토)`는 "언제 가는가"라
 * 연도가 필요 없지만, 결제 일시는 영수증이라 연도가 빠지면 지난해 결제와 올해
 * 결제를 구분할 수 없다.
 *
 * 시각은 Asia/Seoul로 고정한다. 서버 타임존에 따라 자정 근처의 결제가 하루 전날
 * 것으로 보이면 안 된다.
 */

const PARTS = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 결제 일시 — `2026년 8월 19일 오후 2:10`. */
export function formatPaidAt(iso: string): string {
  const collected: Record<string, string> = {};
  for (const part of PARTS.formatToParts(new Date(iso))) {
    collected[part.type] = part.value;
  }

  const hour = Number(collected.hour ?? "0");
  const meridiem = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  return `${collected.year}년 ${Number(collected.month)}월 ${Number(collected.day)}일 ${meridiem} ${hour12}:${collected.minute}`;
}
