@AGENTS.md

# 디자인 SSOT: Storybook

- 모든 UI 작업은 Storybook을 SSOT로 삼는다.
- 작업 전 `src/stories/**`에서 해당 컴포넌트 스토리를 먼저 확인한다.
- UI는 `src/components/foundation/*`, `src/components/ui/*`를 그대로 재사용한다. 신규 구현·복제·인라인 스타일 금지.
- 색상/타이포/아이콘/스페이싱은 `src/tokens/*`만 사용한다. 하드코딩 금지.
- 기존 컴포넌트로 불가능할 때만 신규 컴포넌트를 만들고, `src/components/ui/`에 추가 후 `src/stories/ui/`에 스토리를 함께 작성한다.
- 컴포넌트 API(props) 변경 시 스토리를 동시에 갱신한다.

# 반응형: 최대 1280 카드 그리드

- 폭 규칙은 `src/components/layout/PageContainer.tsx`에만 둔다. 페이지에서 `max-w`·좌우 패딩을 직접 쓰지 않는다.
- 컨테이너: `mx-auto` + 최대 1280. 1280 초과분은 좌우 여백으로 흘린다.
- 좌우 패딩: 기본 16 / `md` 24 / `lg` 32.
- 카드 그리드: 1열 → `md` 2열 → `lg` 3열 → `xl` 4열.
- 내비게이션: 모바일 하단 탭 + FAB, `md`부터 상단 헤더. 두 표면이 동시에 보이면 안 된다.
- 본문 폭 상한: 그리드 1280 / 읽기(상세) 800 / 폼 640.
- 신규 페이지는 `AppShell` + `PageContainer`로 감싼다.
- 모바일은 design.pen 360px 시안을 그대로 따르고, 확장은 위 규칙으로만 만든다.

# 데이터 접근: Supabase는 반드시 Next.js BFF 경유

- 모든 Supabase 호출은 Next.js 서버(BFF)에서만 한다. 클라이언트 컴포넌트에서 Supabase SDK를 직접 호출하거나 Supabase URL을 fetch 하지 않는다.
- BFF 표면은 두 가지만 쓴다: `src/app/api/**/route.ts`(Route Handler)와 서버 액션(`"use server"`). 클라이언트는 이 둘만 호출한다.
- Supabase 클라이언트 생성은 `src/lib/supabase/server.ts` 한 곳에 모은다. 컴포넌트·페이지에서 `createClient`를 직접 만들지 않는다.
- 서비스 키·DB 접속 정보 등 비밀값은 서버 전용 환경변수로만 둔다. `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- 인증 세션은 서버 쿠키 기반으로 처리한다. 토큰을 클라이언트 상태나 `localStorage`에 저장하지 않는다.
- BFF는 통과 프록시가 아니다. 라우트 안에서 입력 검증 → 권한 확인 → Supabase 호출 → 응답 DTO 정형화 순으로 처리하고, Supabase 원본 에러/스키마를 그대로 노출하지 않는다.
- 클라이언트에 내려보내는 타입은 `src/lib/**`에 DTO로 정의한다. DB 테이블 타입을 UI가 직접 알게 하지 않는다.
- 읽기 전용 데이터는 서버 컴포넌트에서 BFF 계층 함수를 직접 호출해도 된다(자기 자신에게 HTTP 요청 금지). 변경(mutation)은 Route Handler 또는 서버 액션으로 한다.
- 소셜 로그인 콜백도 동일하다. OAuth 코드 교환은 서버 라우트에서 처리한다.

## 구현 위치

| 역할 | 파일 |
| --- | --- |
| Supabase 클라이언트 생성 (유일) | `src/lib/supabase/server.ts` |
| 접속 정보 | `src/lib/supabase/env.ts` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) |
| 생성된 DB 타입 | `src/lib/supabase/database.types.ts` |
| 세션 갱신 | `src/lib/supabase/proxy.ts` → `src/proxy.ts` |
| 인증 세션 조회 | `src/lib/auth/session.ts` (`getCurrentUser`, `requireUser`) |
| 로그인/로그아웃 | `src/app/auth/signin/google/route.ts`, `src/app/auth/callback/route.ts`, `src/lib/auth/actions.ts` |
| 라우트 응답·에러 규약 | `src/lib/api/http.ts` (`withRoute`, `jsonOk`, `jsonError`) |
| 도메인 서비스·DTO 예시 | `src/lib/places/service.ts`, `src/lib/places/dto.ts`, `src/app/api/places/route.ts` |

- Next.js 16부터 `middleware.ts`는 `proxy.ts`다. 프로젝트당 하나만 둔다.
- Supabase를 아는 코드는 `src/lib/supabase/*`와 `src/lib/*/service.ts`까지다. Route Handler·페이지는 서비스 함수와 DTO만 다룬다.
- 새 Route Handler는 `withRoute`로 감싸고, 성공은 DTO, 실패는 `{ error: { code, message } }`로 답한다.
- 스키마를 바꾸면 `database.types.ts`를 재생성한다.
- 서버 코드에서 `getSession()`을 신뢰하지 않는다. 인가 판단은 `getUser()`/`getClaims()`로 한다.

## DB·Storage 규약

- 스키마 변경은 Supabase MCP `apply_migration`으로만 한다. `execute_sql`로 DDL을 치지 않는다.
- 새 테이블은 RLS를 켜고 **정책까지 같이** 넣는다. 정책 없는 RLS는 전면 차단이라 조용히 빈 목록이 된다.
- 정책 기본형: 읽기 `using (true)`, 쓰기 `to authenticated` + `(select auth.uid()) = user_id`.
- 소유자 판별은 항상 `auth.uid()`로 한다. 클라이언트가 보낸 `user_id`를 신뢰하지 않는다.
- Storage 경로는 `{user_id}/{파일명}`이다. 정책이 첫 폴더로 소유자를 판별한다.
- `profile.image_path`에는 Storage 객체 경로만 넣는다. 소셜 아바타(절대 URL)는 auth 메타데이터에서 읽는다.
- 가입 시 프로필은 `handle_new_user()` 트리거가 만든다. 앱 코드에서 만들지 않는다.
- 트리거 함수는 `revoke execute ... from public`까지 한다. `anon, authenticated`만 회수하면 PUBLIC 권한이 남는다.
- 마이그레이션 후 `get_advisors({ type: "security" })`로 확인한다.

# 스페이싱 유틸리티 주의

- `globals.css`가 `--spacing-8/12/16/20/24/32`를 디자인 토큰으로 덮어쓴다. 이 숫자들은 Tailwind 스케일이 아니라 px 토큰이다. (`p-32` = 32px, `h-16` = 16px)
- 토큰이 아닌 길이는 임의값으로 쓴다. (`h-[64px]`)
- 타입 스타일은 `@utility`로 선언되어 있으므로 `md:type-heading-sm`처럼 variant를 붙일 수 있다.
