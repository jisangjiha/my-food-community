/**
 * 네이버 지도 API 키. 서버에서 읽어 클라이언트 컴포넌트에 prop으로 내려준다.
 *
 * `NEXT_PUBLIC_` 접두사를 붙이지 않는 이유는 이 값이 비밀이라서가 아니다.
 * 지도 키는 스크립트 URL에 실려 어차피 브라우저에 보인다. 실제 방어선은 NCP
 * 콘솔의 "Web 서비스 URL" 허용목록이다. 접두사를 빼 두면 Next.js가 이 값을
 * 아무 클라이언트 번들에나 인라인하지 않으므로, 키가 나가는 지점이
 * `src/app/register/place/page.tsx` 한 줄로 남는다.
 *
 * `supabase/env.ts`의 `required()`를 쓰지 않고 `null`을 돌려주는 이유:
 * Supabase가 없으면 화면에 보여 줄 것이 없지만, 지도는 등록 흐름의 한 조각이라
 * 키가 없어도 나머지는 굴러가야 한다. 받는 쪽이 `null`을 보고 도식으로 되돌린다.
 */
export const NAVER_MAP_CLIENT_ID = process.env.NAVER_MAP_CLIENT_ID ?? null;
