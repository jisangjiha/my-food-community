import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16부터 middleware의 이름이 proxy로 바뀌었다. 동작은 같다.
 * 프로젝트당 하나만 둘 수 있으므로, 로직은 `src/lib/supabase/proxy.ts`로 뺀다.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 정적 자산을 제외한 모든 경로. 세션 갱신은 페이지든 API든 똑같이 필요하다.
     * - _next/static, _next/image: 빌드 산출물
     * - favicon.ico, 이미지 확장자: 세션과 무관
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
