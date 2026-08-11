import { NextResponse, type NextRequest } from "next/server";

import { requestOrigin, safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth 콜백. 인증 코드를 세션으로 교환한다.
 *
 * 교환이 서버에서 일어나야 토큰이 httpOnly 쿠키로만 존재한다. 클라이언트에서
 * 하면 토큰이 브라우저 스토리지에 남고, 그건 CLAUDE.md가 금지한 형태다.
 */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));

  // 사용자가 Google 동의 화면에서 취소한 경우.
  const oauthError = params.get("error");
  if (oauthError) {
    console.error("[auth] OAuth 제공자 오류", oauthError, params.get("error_description"));
    return NextResponse.redirect(`${origin}/login?error=oauth_denied`);
  }

  const code = params.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth] 코드 교환 실패", error);
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
