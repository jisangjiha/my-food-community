import { jsonOk, withRoute } from "@/lib/api/http";
import type { ProductListDto } from "@/lib/products/dto";
import { listProducts } from "@/lib/products/service";

/**
 * 상품 목록.
 *
 * 카탈로그라 비로그인도 본다. 순서는 CLAUDE.md 규칙 그대로 Supabase 호출 →
 * DTO 정형화이고, Supabase 클라이언트는 이 파일에 등장하지 않는다.
 *
 * 상품을 만드는 것은 운영자라 쓰기 메서드는 없다.
 */
export const GET = withRoute(async () => {
  const items = await listProducts();

  return jsonOk<ProductListDto>({ items });
});
