import { jsonOk, withRoute } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import type { PlaceListDto } from "@/lib/places/dto";
import { listPlaces } from "@/lib/places/service";

/** 내가 등록한 맛집. 로그인 필수. */
export const GET = withRoute(async () => {
  const user = await requireUser();
  const items = await listPlaces({ viewerId: user.id, authorId: user.id });

  return jsonOk<PlaceListDto>({ items });
});
