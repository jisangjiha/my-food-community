import { jsonOk, withRoute } from "@/lib/api/http";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { readUpdatePlaceInput } from "@/lib/places/input";
import { getPlace, softDeletePlace, updatePlace } from "@/lib/places/service";

/**
 * 맛집 상세/수정/삭제.
 *
 * Next 16에서 동적 세그먼트(`params`)는 Promise다. 반드시 await 한다.
 */
type RouteParams = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_request: Request, { params }: RouteParams) => {
  const { id } = await params;

  // 상세도 비로그인이 볼 수 있다. 사용자는 isMine 계산에만 쓴다.
  const viewer = await getCurrentUser();
  const place = await getPlace(id, viewer?.id ?? null);

  return jsonOk(place);
});

/**
 * 수정. 본문은 등록과 같은 multipart/form-data다.
 *
 * 필드: `title`, `content`, `keepImagePaths`(그대로 둘 기존 사진 경로, 0개 이상),
 * `images`(새로 올릴 파일, 0개 이상). 둘을 합쳐 1~5장이어야 한다.
 *
 * PUT이 아니라 PATCH인 이유: 등록 시각과 작성자처럼 이 요청이 건드리지 않는
 * 필드가 있다. 본문이 리소스 전체를 대신하지는 않는다.
 */
export const PATCH = withRoute(
  async (request: Request, { params }: RouteParams) => {
    const { id } = await params;
    const user = await requireUser();
    const input = await readUpdatePlaceInput(request);

    const place = await updatePlace(id, input, user.id);

    return jsonOk(place);
  },
);

/**
 * 삭제. 행을 지우지 않고 `deleted_at`을 찍는 소프트 삭제다.
 *
 * 돌려줄 표현이 없으므로 204다. 클라이언트는 `res.ok`만 보면 된다.
 */
export const DELETE = withRoute(
  async (_request: Request, { params }: RouteParams) => {
    const { id } = await params;
    const user = await requireUser();

    await softDeletePlace(id, user.id);

    return new Response(null, { status: 204 });
  },
);
