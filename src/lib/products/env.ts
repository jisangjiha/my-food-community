import "server-only";

/**
 * 외부 이미지 호스트의 주소 앞부분.
 *
 * 상품 상세 이미지는 아직 우리 버킷에 없어 Unsplash에서 가져온다. 규칙은
 * `supabase/env.ts`의 `SUPABASE_STORAGE_URL`과 같다 — 주소의 앞단(호스트)은
 * 환경변수, 뒷단(경로)은 DB 컬럼이다. 호스트가 바뀌어도 DB는 그대로다.
 *
 * 나중에 상세 이미지를 `product-image` 버킷으로 옮기면, DB 컬럼을 파일명으로
 * 바꾸고 서비스에서 붙이는 앞단만 갈아끼우면 된다.
 *
 * `local-search/env.ts`와 같은 이유로 함수로 감싼다. 모듈 최상단에서 던지면 값이
 * 없는 환경에서 `next build`가 이 모듈을 훑는 것만으로 실패한다. 지연시키면
 * 실제로 상품 화면을 그릴 때만 터진다 — 고쳐야 할 시점에 정확히.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `환경변수 ${name}가 없습니다. .env.example을 참고해 .env.local에 추가하세요.`,
    );
  }
  return value;
}

export function unsplashImageBaseUrl(): string {
  return required("UNSPLASH_IMAGE_URL", process.env.UNSPLASH_IMAGE_URL);
}
