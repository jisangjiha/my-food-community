/**
 * 모임 상품 DTO — BFF가 화면으로 내려보내는 유일한 모양.
 *
 * `meeting` 테이블의 Row가 아니다. 화면이 `max_per_person`·`category_label` 같은
 * 컬럼명에 묶이면 이름 하나 바꿀 때 화면이 깨진다. 경계는 여기다.
 *
 * 서버 전용이 아니다. 결제 시트(클라이언트)가 타입과 상수를 쓴다.
 */

/**
 * 판매 상태. 세 값이 상세 화면의 CTA를 정한다(PRD 269).
 *
 * `status`·`closes_at`·정원을 화면마다 다시 비교하지 않도록 서버에서 한 번
 * 접어서 내린다. 세 곳에서 각자 비교하면 한 곳만 규칙이 바뀌는 날이 온다.
 */
export type MeetingSale = "on_sale" | "sold_out" | "closed";

export interface MeetingDto {
  id: string;
  title: string;
  /** 시안의 눈썹 문구 — `이웃 모임 · 맛집 투어`. */
  categoryLabel: string;
  summary: string;
  description: string;
  /** 없으면 화면이 아이콘 자리표시자를 그린다. */
  imageUrl: string | null;
  address: string;
  /** 좌표는 둘 다 있을 때만 채워진다. 없으면 지도를 그리지 않는다. */
  coords: { lat: number; lng: number } | null;
  /** 1인 가격(원). */
  price: number;
  capacity: number;
  /** 1인당 최대 구매 매수. */
  maxPerPerson: number;
  seatsTaken: number;
  seatsLeft: number;
  /** 시트의 `+` 상한 — `min(남은 자리, 1인당 최대)`(PRD 283). */
  maxSelectable: number;
  /** ISO 8601. 표기는 화면에서 한다. */
  startsAt: string;
  closesAt: string;
  sale: MeetingSale;
}

/** 배너에 넘기는 최소 정보. 클라이언트 컴포넌트라 필요한 것만 건넨다. */
export interface MeetingBannerItem {
  id: string;
  title: string;
  categoryLabel: string;
  seatsLeft: number;
  startsAt: string;
  price: number;
}

export function toBannerItem(meeting: MeetingDto): MeetingBannerItem {
  return {
    id: meeting.id,
    title: meeting.title,
    categoryLabel: meeting.categoryLabel,
    seatsLeft: meeting.seatsLeft,
    startsAt: meeting.startsAt,
    price: meeting.price,
  };
}

/** 배너에 세울 최대 개수(PRD 256). */
export const MEETING_BANNER_LIMIT = 5;
