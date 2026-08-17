import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/** 로그인해야만 열리는 경로. 나머지는 비로그인도 볼 수 있다. */
const PROTECTED_PREFIXES = ["/my", "/register", "/payments"];

/**
 * 매 요청마다 Supabase 세션을 갱신하고, 새 토큰을 응답 쿠키에 실어 보낸다.
 *
 * 이게 없으면 액세스 토큰이 만료돼도 서버가 갱신하지 못해 사용자가 임의로
 * 로그아웃된 것처럼 보인다.
 *
 * proxy는 낙관적 검사(optimistic check)까지만 한다. 실제 인가는 데이터를 만지는
 * Route Handler·서버 액션에서 다시 확인한다.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // 요청마다 새로 만든다. 모듈 스코프에 두면 세션이 요청 간에 섞인다.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
        // 세션 쿠키가 실린 응답이 CDN에 캐시되면 남의 세션이 새어 나간다.
        for (const [key, value] of Object.entries(headers)) {
          supabaseResponse.headers.set(key, value);
        }
      },
    },
  });

  // createServerClient와 getClaims 사이에 다른 코드를 넣지 않는다.
  // getClaims를 빼면 토큰이 갱신되지 않아 사용자가 임의로 로그아웃된다.
  // getSession은 JWT를 검증하지 않으므로 서버 코드에서 신뢰하면 안 된다.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!claims && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // supabaseResponse를 그대로 반환해야 한다. 새 응답을 만들면 쿠키를 옮겨 담아야
  // 하고(`newResponse.cookies.setAll(supabaseResponse.cookies.getAll())`),
  // 빠뜨리면 브라우저와 서버의 세션이 어긋나 로그인이 끊긴다.
  return supabaseResponse;
}
