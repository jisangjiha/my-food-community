import { jsonOk, withRoute } from "@/lib/api/http";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import type { PlaceListDto } from "@/lib/places/dto";
import { readCreatePlaceInput } from "@/lib/places/input";
import { createPlace, listPlaces } from "@/lib/places/service";

/**
 * 맛집 목록/등록 — BFF 라우트의 기준 예시.
 *
 * 순서는 CLAUDE.md 규칙 그대로: 입력 검증 → 권한 확인 → Supabase 호출 →
 * DTO로 정형화. Supabase 클라이언트는 이 파일에 등장하지 않는다.
 */

export const GET = withRoute(async () => {
  // 목록은 비로그인도 볼 수 있다. 사용자는 isMine 계산에만 쓴다.
  const viewer = await getCurrentUser();
  const items = await listPlaces({ viewerId: viewer?.id ?? null });

  return jsonOk<PlaceListDto>({ items });
});

/**
 * 등록. 본문은 multipart/form-data다.
 *
 * 필드: `title`, `content`, `images`(같은 이름으로 1~5개).
 * 사진은 브라우저가 Storage에 직접 올리지 않는다. 여기서 받아 서버가 올린다.
 */
export const POST = withRoute(async (request: Request) => {
  const user = await requireUser();
  const input = await readCreatePlaceInput(request);

  const place = await createPlace(input, user.id);

  return jsonOk(place, { status: 201 });
});
