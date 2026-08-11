import type { NextRequest } from "next/server";

/**
 * 로그인 후 돌아갈 경로. 오픈 리다이렉트를 막기 위해 앱 내부 경로만 허용한다.
 *
 * `//evil.com`과 `/\evil.com`은 브라우저가 프로토콜 상대 URL로 해석하므로
 * 앞이 `/`라는 것만으로는 부족하다.
 */
export function safeNextPath(value: string | null, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/**
 * 리다이렉트 URL을 만들 때 쓸 오리진.
 *
 * 로드밸런서 뒤에서는 `request.nextUrl.origin`이 내부 호스트를 가리킬 수 있어
 * 콜백 URL이 깨진다. 프록시가 붙여 준 `x-forwarded-*`를 먼저 본다.
 */
export function requestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!forwardedHost) return request.nextUrl.origin;

  const forwardedProto =
    request.headers.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");

  return `${forwardedProto}://${forwardedHost}`;
}
