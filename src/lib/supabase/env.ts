/**
 * Supabase 접속 정보. 서버에서만 읽힌다.
 *
 * `NEXT_PUBLIC_` 접두사가 없으므로 Next.js는 이 값을 클라이언트 번들에 인라인하지
 * 않는다. 클라이언트 컴포넌트가 실수로 이 모듈을 import 해도 값은 undefined가 되고,
 * 아래 검사에서 즉시 터진다. 조용히 새는 경로가 없다는 뜻이다.
 *
 * `server-only`를 여기 두지 않는 이유: proxy 런타임에서도 이 모듈을 쓴다.
 * 실제 Supabase 클라이언트를 만드는 `server.ts`가 `server-only`로 막는다.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `환경변수 ${name}가 없습니다. .env.example을 참고해 .env.local에 추가하세요.`,
    );
  }
  return value;
}

export const SUPABASE_URL = required("SUPABASE_URL", process.env.SUPABASE_URL);

export const SUPABASE_PUBLISHABLE_KEY = required(
  "SUPABASE_PUBLISHABLE_KEY",
  process.env.SUPABASE_PUBLISHABLE_KEY,
);

/**
 * 공개 Storage 객체의 주소 앞부분. 버킷 이름 바로 앞까지다.
 *
 * 예: `https://<project-ref>.supabase.co/storage/v1/object/public`
 *
 * 이 값만 바꾸면 CDN이나 커스텀 도메인으로 이미지를 돌릴 수 있다.
 * SDK의 `getPublicUrl()`은 Supabase 호스트에 고정되어 그 여지가 없다.
 */
export const SUPABASE_STORAGE_URL = required(
  "SUPABASE_STORAGE_URL",
  process.env.SUPABASE_STORAGE_URL,
);
