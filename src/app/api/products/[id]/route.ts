import { jsonOk, withRoute } from "@/lib/api/http";
import { getProduct } from "@/lib/products/service";

/**
 * 상품 상세.
 *
 * Next 16에서 동적 세그먼트(`params`)는 Promise다. 반드시 await 한다.
 *
 * 없는 상품과 공개가 아닌 상품, 숫자가 아닌 id는 모두 404다. 서비스가
 * `NotFoundError`를 던지고 `withRoute`가 상태 코드로 옮긴다.
 */
type RouteParams = { params: Promise<{ id: string }> };

export const GET = withRoute(
  async (_request: Request, { params }: RouteParams) => {
    const { id } = await params;

    return jsonOk(await getProduct(id));
  },
);
