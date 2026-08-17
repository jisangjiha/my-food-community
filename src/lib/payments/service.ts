import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * 결제 데이터 접근 계층.
 *
 * Supabase를 아는 코드는 여기까지다. 화면은 DTO만 받는다.
 *
 * RLS가 자기 행만 보여 주므로 `user_id` 조건은 방어용이다. 정책이 느슨해지는 날
 * 조용히 남의 결제를 세지 않도록 읽는 쪽 코드에도 조건을 남긴다.
 */

/**
 * 이 사용자가 이 모임을 이미 결제했는지. 결제한 건의 id, 없으면 null.
 *
 * 상세 화면의 CTA가 `결제 내역 보기`로 바뀌는 조건이다(PRD 275). DB에도 같은
 * 사실이 `(user_id, meeting_id) where status='paid'` 유니크 인덱스로 들어 있다.
 */
export async function findPaidPaymentId(
  meetingId: string,
  userId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment")
    .select("id")
    .eq("meeting_id", meetingId)
    .eq("user_id", userId)
    .eq("status", "paid")
    .maybeSingle();

  if (error) {
    console.error("[payments] 결제 여부 조회 실패", error);
    throw new Error("결제 정보를 불러오지 못했습니다.");
  }

  return data?.id ?? null;
}
