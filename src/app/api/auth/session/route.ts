import { jsonOk, withRoute } from "@/lib/api/http";
import { getCurrentUser } from "@/lib/auth/session";
import type { SessionDto } from "@/lib/profile/dto";

/**
 * 현재 로그인 상태. 클라이언트 컴포넌트가 로그인 여부를 물어볼 때 쓴다.
 *
 * 토큰이나 세션 객체는 내려보내지 않는다. 화면이 필요한 것은 "누구인가"뿐이고,
 * 토큰은 httpOnly 쿠키 밖으로 나갈 이유가 없다.
 *
 * 서버 컴포넌트라면 이 라우트를 fetch 하지 말고 `getCurrentUser()`를 직접 부른다.
 */
export const GET = withRoute(async () => {
  const user = await getCurrentUser();

  if (!user) {
    return jsonOk<SessionDto>({ authenticated: false, user: null });
  }

  return jsonOk<SessionDto>({
    authenticated: true,
    user: {
      id: user.id,
      nickname: user.name,
      avatarUrl: user.avatarUrl,
    },
  });
});
