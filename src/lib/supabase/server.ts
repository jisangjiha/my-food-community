import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "./database.types";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  supabaseSecretKey,
} from "./env";

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

/**
 * 세션이 없는 서버 간 호출 전용 클라이언트. RLS를 우회한다.
 *
 * 지금 이것을 쓰는 곳은 결제 웹훅 하나다. 웹훅은 포트원 서버가 부르는 것이라
 * 쿠키도 세션도 없고, 그래서 `auth.uid()`가 없다. 사용자를 대신해 결제 원장에
 * 행을 남기려면 RLS 바깥에서 `security definer` 함수를 부르는 수밖에 없다.
 *
 * 대신 두 가지를 지킨다.
 *
 * - 이 클라이언트로 테이블을 직접 쓰지 않는다. 쓰기는 `record_payment`처럼
 *   안에서 다시 검사하는 함수만 지난다.
 * - 이 문을 여는 조건은 포트원 웹훅 서명 검증 통과 + 결제 재조회 통과다.
 *   그 둘을 지나기 전에는 이 클라이언트를 만들지 않는다.
 *
 * 쿠키를 읽지 않으므로 `async`가 아니다. 세션 저장·갱신도 끈다 — 서버 간
 * 호출에 붙일 세션이 없고, 켜 두면 요청 사이에 상태가 남는다.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(SUPABASE_URL, supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
