import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/**
 * 프로젝트에서 Supabase 클라이언트를 만드는 유일한 곳.
 *
 * `server-only`가 붙어 있으므로 클라이언트 컴포넌트에서 import 하면 빌드가 실패한다.
 * CLAUDE.md의 "Supabase 호출은 서버에서만" 규칙을 타입 검사가 아니라 번들러가 강제한다.
 *
 * 요청마다 새로 만든다. 모듈 스코프에 캐시하면 서버 인스턴스가 재사용될 때
 * 한 사용자의 세션이 다른 사용자 요청으로 새어 나갈 수 있다.
 *
 * 호출 가능한 곳: 서버 컴포넌트, Route Handler, 서버 액션.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // 서버 컴포넌트 렌더링 중에는 쿠키를 쓸 수 없다. 토큰 갱신은
            // proxy.ts가 매 요청마다 처리하므로 여기서는 무시해도 된다.
          }
        },
      },
    },
  );
}
