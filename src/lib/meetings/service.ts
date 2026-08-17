import "server-only";

import { NotFoundError } from "@/lib/api/http";
import { createClient } from "@/lib/supabase/server";

import { MEETING_BANNER_LIMIT, type MeetingDto, type MeetingSale } from "./dto";

/**
 * 모임 상품 데이터 접근 계층.
 *
 * Supabase를 아는 코드는 여기까지다. 화면은 DTO만 받는다.
 *
 * 쓰기 함수는 없다. 상품을 만드는 것은 운영자이고 어드민 화면은 이번 범위 밖이라
 * 앱에는 읽는 경로만 있다.
 */

/**
 * `seats_taken`은 트리거가 유지하는 카운터 컬럼이다. `payment`는 RLS로 자기 행만
 * 보이므로 여기서 직접 합산하면 남의 결제가 빠진 수가 나온다.
 */
const MEETING_SELECT =
  "id, title, category_label, summary, description, image_url, address, lat, lng, price, capacity, max_per_person, starts_at, closes_at, status, seats_taken";

interface MeetingRow {
  id: string;
  title: string;
  category_label: string;
  summary: string;
  description: string;
  image_url: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  price: number;
  capacity: number;
  max_per_person: number;
  starts_at: string;
  closes_at: string;
  status: string;
  seats_taken: number;
}

/**
 * 배너·목록용 모임.
 *
 * 마감된 상품과 정원이 찬 상품은 내린다(PRD 257). 배너가 없으면 화면이 영역 자체를
 * 감추므로 빈 배열을 그대로 돌려준다.
 */
export async function listMeetings(): Promise<MeetingDto[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meeting")
    .select(MEETING_SELECT)
    .eq("status", "on_sale")
    .gt("closes_at", new Date().toISOString())
    .order("display_order", { ascending: true })
    .limit(MEETING_BANNER_LIMIT);

  if (error) {
    console.error("[meetings] 목록 조회 실패", error);
    throw new Error("모임 목록을 불러오지 못했습니다.");
  }

  return ((data ?? []) as unknown as MeetingRow[])
    .map(toDto)
    // 정원이 찬 상품은 배너에서 내린다. DB에서 걸 수 없는 조건이라 여기서 한다.
    .filter((meeting) => meeting.sale === "on_sale");
}

export async function getMeeting(id: string): Promise<MeetingDto> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meeting")
    .select(MEETING_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[meetings] 상세 조회 실패", error);
    throw new Error("모임을 불러오지 못했습니다.");
  }
  if (!data) {
    throw new NotFoundError("모임을 찾을 수 없습니다.");
  }

  return toDto(data as unknown as MeetingRow);
}

function toDto(row: MeetingRow): MeetingDto {
  const seatsLeft = Math.max(0, row.capacity - row.seats_taken);

  return {
    id: row.id,
    title: row.title,
    categoryLabel: row.category_label,
    summary: row.summary,
    description: row.description,
    imageUrl: row.image_url,
    address: row.address,
    // 하나만 있는 행에 지도를 깔면 화면이 아무 데나 가리키면서 아는 척을 한다.
    coords:
      row.lat !== null && row.lng !== null
        ? { lat: row.lat, lng: row.lng }
        : null,
    price: row.price,
    capacity: row.capacity,
    maxPerPerson: row.max_per_person,
    seatsTaken: row.seats_taken,
    seatsLeft,
    maxSelectable: Math.min(seatsLeft, row.max_per_person),
    startsAt: row.starts_at,
    closesAt: row.closes_at,
    sale: saleStateOf(row, seatsLeft),
  };
}

function saleStateOf(row: MeetingRow, seatsLeft: number): MeetingSale {
  if (row.status !== "on_sale" || new Date(row.closes_at) <= new Date()) {
    return "closed";
  }
  return seatsLeft <= 0 ? "sold_out" : "on_sale";
}
