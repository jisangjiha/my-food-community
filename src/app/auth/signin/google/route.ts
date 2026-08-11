import { NextResponse, type NextRequest } from "next/server";

import { requestOrigin, safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Google 로그인 시작점.
 *
 * `signInWithOAuth`를 서버에서 부르는 이유: PKCE의 code_verifier가 서버 쿠키에
 * 저장돼야 콜백 라우트가 코드를 세션으로 교환할 수 있다. 브라우저에서 시작하면
 * verifier가 클라이언트 스토리지로 가고, CLAUDE.md의 BFF 규칙에서 벗어난다.
 *
 * 여기서는 리다이렉트만 하고 세션을 만들지 않는다. 세션은 콜백에서 생긴다.
 */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    // Supabase 원본 에러는 노출하지 않는다. 로그인 화면이 사용자용 문구를 띄운다.
    console.error("[auth] Google 로그인 시작 실패", error);
    return NextResponse.redirect(`${origin}/login?error=oauth_start_failed`);
  }

  return NextResponse.redirect(data.url);
}
