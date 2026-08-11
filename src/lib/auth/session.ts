import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * UI로 내려보내는 사용자 DTO.
 *
 * Supabase의 `User` 객체를 그대로 넘기지 않는다. 거기엔 앱이 쓰지 않는 인증
 * 내부 필드(identities, app_metadata, 토큰 관련 타임스탬프)가 딸려 있고,
 * 컴포넌트가 그 모양에 의존하기 시작하면 인증 스키마 변경이 UI를 깨뜨린다.
 */
export interface AuthUser {
  id: string;
  email: string | null;
  /** 소셜 프로필 이름. 없으면 이메일 아이디 부분. */
  name: string;
  avatarUrl: string | null;
}

/**
 * 현재 로그인한 사용자. 비로그인이면 null.
 *
 * `getUser()`는 Auth 서버에 토큰을 검증시킨다. `getSession()`은 쿠키를 그대로
 * 믿기 때문에 서버 코드에서 인가 판단에 쓰면 안 된다.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const metadata = user.user_metadata ?? {};
  const name =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    user.email?.split("@")[0] ||
    "사용자";

  return {
    id: user.id,
    email: user.email ?? null,
    name,
    avatarUrl:
      typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
  };
}

/** 인증이 필요한 BFF 경로에서 쓴다. 비로그인이면 던진다. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("로그인이 필요합니다.");
    this.name = "UnauthorizedError";
  }
}
