/**
 * 모임 화면의 날짜·금액 표기.
 *
 * 서버 전용이 아니다. 배너(클라이언트)와 상세(서버)가 같은 모양을 써야 한다.
 *
 * 모든 시각은 Asia/Seoul로 고정한다. 환불 규정이 KST 기준이라고 못 박혀 있고
 * (PRD 337), 서버 타임존이나 브라우저 타임존에 따라 "12월 14일"이 "12월 13일"로
 * 보이면 사용자가 하루를 잘못 알고 온다.
 *
 * `Intl`의 조합 결과를 그대로 쓰지 않고 부품을 받아 직접 조립한다. 로케일 데이터가
 * 바뀌면 "12월 14일 (토)"의 괄호나 공백이 조용히 달라지는데, 시안 문구는 고정이다.
 */

const KST = "Asia/Seoul";

const PARTS = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

interface DateParts {
  year: string;
  month: string;
  day: string;
  weekday: string;
  hour: string;
  minute: string;
}

function partsOf(iso: string): DateParts {
  const collected: Record<string, string> = {};
  for (const part of PARTS.formatToParts(new Date(iso))) {
    collected[part.type] = part.value;
  }
  return {
    year: collected.year ?? "",
    month: collected.month ?? "",
    day: collected.day ?? "",
    // ko-KR의 short weekday는 "토"다. 괄호는 문구를 조립할 때 붙인다.
    weekday: collected.weekday ?? "",
    hour: collected.hour ?? "",
    minute: collected.minute ?? "",
  };
}

/** 24시 표기를 시안의 "오후 2:00"으로. */
function toKorean12Hour(hour: string, minute: string): string {
  const value = Number(hour);
  const meridiem = value < 12 ? "오전" : "오후";
  const hour12 = value % 12 === 0 ? 12 : value % 12;
  return `${meridiem} ${hour12}:${minute}`;
}

/** `50,000원`. */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** 상세의 일시 — `12월 14일 (토) 오후 2:00`. */
export function formatMeetingDateTime(iso: string): string {
  const { month, day, weekday, hour, minute } = partsOf(iso);
  return `${Number(month)}월 ${Number(day)}일 (${weekday}) ${toKorean12Hour(hour, minute)}`;
}

/** 상세의 모집 마감 — `12월 13일 (금) 23:59`. 마감은 시안이 24시 표기다. */
export function formatMeetingDeadline(iso: string): string {
  const { month, day, weekday, hour, minute } = partsOf(iso);
  return `${Number(month)}월 ${Number(day)}일 (${weekday}) ${hour}:${minute}`;
}

/** 배너·내역 카드의 짧은 일시 — `12/14 토 14:00`. */
export function formatMeetingShort(iso: string): string {
  const { month, day, weekday, hour, minute } = partsOf(iso);
  return `${Number(month)}/${Number(day)} ${weekday} ${hour}:${minute}`;
}

/** `12/13` — 결제일·취소일. */
export function formatMonthDay(iso: string): string {
  const { month, day } = partsOf(iso);
  return `${Number(month)}/${Number(day)}`;
}

/** 결제 완료 화면의 결제 일시 — `2026.12.13 21:04`. */
export function formatTimestamp(iso: string): string {
  const { year, month, day, hour, minute } = partsOf(iso);
  return `${year}.${month}.${day} ${hour}:${minute}`;
}
