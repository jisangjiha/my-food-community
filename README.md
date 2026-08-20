# Hidden Eats

동네 사람들이 진짜 추천하는 로컬 맛집 커뮤니티.

포털 지도와 대형 리뷰 앱에는 광고성 맛집이 넘쳐서, 정작 "가볼 만한 진짜 좋은 곳"은
찾기 어렵다. Hidden Eats는 실제로 가본 사람이 사진과 지도를 붙여 맛집을 올리고,
이웃이 그것을 목록과 검색으로 발견하는 작은 커뮤니티다.

구글 계정으로 로그인하고, 지도에서 위치를 찍어 맛집을 등록하고, 내가 올린 곳을
관리한다. 자세한 제품 배경은 [`02-prd.md`](02-prd.md)에 있다.

## 화면

| 경로 | 하는 일 |
| --- | --- |
| `/` | 홈 피드. 상단 상품 배너, 등록된 맛집 카드 목록과 카테고리 칩 |
| `/login` | 구글 로그인 |
| `/register` | 맛집 등록 폼. 장소를 먼저 고른 뒤에 들어온다 |
| `/register/place` | 지도에서 위치 확정. 지도를 움직이면 지번주소가 따라온다 |
| `/register/place/search` | 네이버 지역검색으로 장소 찾기 |
| `/restaurants/[id]` | 맛집 상세 |
| `/restaurants/[id]/edit` | 맛집 수정 |
| `/products` | 상품 목록. 모임·클래스 카드 그리드 |
| `/products/[id]` | 상품 상세. 배너·정보 카드·소개·상세 이미지, 하단 결제 바 |
| `/payments/[paymentId]` | 결제 완료. 조회만 하는 화면이라 새로고침해도 안전하다 |
| `/payments/failed` | 결제 실패. 사유별 안내 (로그인 없이 열린다) |
| `/my` | 내 프로필과 세 탭 — 내가 쓴 글 / 결제 내역 / 취소 내역 (`?tab=payments`, `?tab=cancels`) |
| `/my/edit` | 프로필 수정 |

## 기술 스택

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS 4** — 디자인 토큰은 `src/tokens/*`
- **Supabase** — 인증(구글 OAuth), Postgres, Storage
- **네이버 지도 API** — 지도 표시, 지역검색, 리버스 지오코딩
- **포트원(PortOne) V2** — 카드 결제, 전액 취소, 결제·취소 웹훅. 규칙은
  `rules/payment.md`가 SSOT다
- **Storybook 10** — 디자인 시스템의 단일 진실 공급원(SSOT)

## 실행 방법

### 요구사항

- **Node.js 22.6 이상.** Next 16 자체는 20.9면 되지만, 확인 스크립트가
  `--experimental-strip-types`로 `.mts`를 직접 돌린다.
- Supabase 프로젝트 하나
- 네이버 클라우드 플랫폼(NCP) 계정 — 지도를 쓰려면 필요하다

### 1. 설치

```bash
git clone git@github.com:jisangjiha/my-food-community.git
cd my-food-community
npm ci
```

### 2. 환경변수

`.env.example`을 복사해 `.env.local`을 만들고 값을 채운다.

```bash
cp .env.example .env.local
```

| 변수 | 발급처 | 없으면 |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase 대시보드 → Project Settings → API | 앱이 뜨지 않는다 |
| `SUPABASE_PUBLISHABLE_KEY` | 위와 같은 화면 | 앱이 뜨지 않는다 |
| `SUPABASE_STORAGE_URL` | `{SUPABASE_URL}/storage/v1/object/public` | 앱이 뜨지 않는다 |
| `UNSPLASH_IMAGE_URL` | `https://images.unsplash.com` (고정) | 상품 화면이 500 |
| `NAVER_MAP_CLIENT_ID` | NCP 콘솔 → Maps → Application | 지도 자리에 도식이 나온다 (앱은 정상) |
| `NAVER_SEARCH_CLIENT_ID` | NCP 콘솔 → API Hub → Search | 장소 검색 화면이 500 |
| `NAVER_SEARCH_CLIENT_SECRET` | 위와 같은 화면 | 장소 검색 화면이 500 |
| `NAVER_GEOCODE_API_KEY_ID` | NCP 콘솔 → Maps (지역검색 키와 다르다) | 주소가 "불러오지 못했어요"에 머문다 |
| `NAVER_GEOCODE_API_KEY` | 위와 같은 화면 | 주소가 "불러오지 못했어요"에 머문다 |
| `PORTONE_STORE_ID` | 포트원 콘솔 → 결제연동 | 결제 버튼만 잠긴다 (상세는 정상) |
| `PORTONE_CHANNEL_KEY` | 위와 같은 화면 | 위와 같음 |
| `PORTONE_API_SECRET` | 위와 같은 화면 → V2 API Secret | 결제 확정이 실패한다 |
| `PORTONE_WEBHOOK_SECRET` | 포트원 콘솔 → 결제연동 → 결제알림(Webhook) 관리 | 웹훅이 500 (포트원이 재전송한다) |
| `SUPABASE_SECRET_KEY` | Supabase 대시보드 → Project Settings → API | 위와 같음 (리다이렉트 결제 확정은 정상) |

네이버 키가 세 종류라는 점을 헷갈리기 쉽다. 지도 표시용(`NAVER_MAP_CLIENT_ID`),
지역검색용(`NAVER_SEARCH_*`), 리버스 지오코딩용(`NAVER_GEOCODE_*`)이 전부 별개고
호스트도 다르다. 각 변수의 자세한 설명은 `.env.example`의 주석에 있다.

`NEXT_PUBLIC_` 접두사는 어디에도 붙이지 않는다. 모든 값은 서버에서만 읽는다.
지도 키만 서버 컴포넌트가 prop으로 한 번 내려보내며, 그 키의 실제 방어선은
NCP 콘솔에 등록하는 **Web 서비스 URL 허용목록**이다. 개발용 `http://localhost:3000`을
꼭 등록해 둔다.

### 3. Supabase 준비

이 저장소에는 마이그레이션 파일이 없다. 스키마는 원격 Supabase 프로젝트에 직접
적용되어 있고, 생성된 타입만 `src/lib/supabase/database.types.ts`로 들어와 있다.
새 프로젝트에 처음 붙인다면 아래를 갖춰야 한다.

- **테이블**: `place`, `place_image`, `profile`, `product`, `payment`,
  `payment_snapshot` — 컬럼 구조는 `database.types.ts` 참고
- **결제 원장 함수**: `record_payment`, `record_cancellation` (둘 다 `security definer`).
  `payment`에는 insert 정책이 없고 모든 쓰기가 이 둘을 지난다 — 자세한 규약은
  `rules/payment.md` §4.1
- **상품 등록**: 운영자 어드민 화면은 아직 없다. `product` 행을 SQL로 넣고,
  `status`를 `Public`으로 둬야 목록에 나온다. 정책은 읽기 전용이라 앱은 쓰지 않는다
- **Storage 버킷**: `profile-image`, `place_image`, `product-image` (모두 공개 읽기)
- **RLS**: 모든 테이블에 켜고 정책까지 함께 넣는다. 정책 없는 RLS는 조용히 빈
  목록이 된다. 읽기는 `using (true)`, 쓰기는 `to authenticated` +
  `(select auth.uid()) = user_id`
- **트리거**: 가입 시 프로필을 만드는 `handle_new_user()`
- **인증**: Authentication → Providers에서 Google을 켜고, Redirect URLs에
  `http://localhost:3000/auth/callback`을 추가한다

스키마를 바꾸면 타입을 다시 뽑는다.

```bash
supabase gen types typescript --project-id <project-ref> > src/lib/supabase/database.types.ts
```

### 4. 개발 서버

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)을 연다.

디자인 시스템을 보려면 Storybook을 띄운다. UI 작업은 여기서 시작한다.

```bash
npm run storybook   # http://localhost:6006
```

## npm 스크립트

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npm run storybook` | Storybook 개발 서버 (6006) |
| `npm run build-storybook` | Storybook 정적 빌드 |
| `npm run check:parse` | 좌표·HTML 파싱 확인 (`src/lib/local-search/parse.ts`) |
| `npm run check:address` | 지번주소 조립 확인 (`src/lib/reverse-geocode/format.ts`) |

테스트 러너는 없다. 대신 조용히 틀리기 쉬운 두 곳(좌표 파싱, 주소 조립)만
`scripts/*.mts`로 확인한다. 지도는 계산이 틀려도 아무 불평 없이 엉뚱한 곳을 가리킨다.

## 구조

```
src/
  app/            라우트. 페이지와 Route Handler
  components/
    foundation/   Icon, Text — 원시 요소
    ui/           디자인 시스템 컴포넌트
    layout/       AppShell, PageContainer — 폭 규칙은 여기에만 있다
    brand/        로고 등 브랜드 요소
    places/       맛집 도메인 컴포넌트
    profile/      프로필 도메인 컴포넌트
  lib/
    supabase/     Supabase 클라이언트 생성·타입 (유일한 접점)
    auth/         세션, 로그인/로그아웃
    api/          Route Handler 응답·에러 규약
    places/       맛집 서비스·DTO
    profile/      프로필 서비스·DTO
    local-search/ 네이버 지역검색
    reverse-geocode/ 네이버 리버스 지오코딩
    maps/         지도 키·상수
  stories/        Storybook 스토리
  tokens/         색·타이포·아이콘·스페이싱 토큰
```

### 지켜야 할 규칙 세 가지

전체 규칙은 [`CLAUDE.md`](CLAUDE.md)에 있다. 요약하면:

1. **Supabase는 반드시 서버(BFF)를 거친다.** 클라이언트 컴포넌트에서 Supabase SDK를
   직접 부르지 않는다. 클라이언트가 만지는 표면은 Route Handler와 서버 액션뿐이고,
   내려가는 것은 DB 행이 아니라 DTO다.
2. **UI의 SSOT는 Storybook이다.** 새로 만들기 전에 `src/stories/**`를 먼저 본다.
   색·타이포·간격은 `src/tokens/*`만 쓴다. 하드코딩하지 않는다.
3. **폭 규칙은 `PageContainer` 한 곳에 있다.** 페이지에서 `max-w`나 좌우 패딩을
   직접 쓰지 않는다. 최대 1280, 그리드는 1 → 2 → 3 → 4열.

`globals.css`가 `--spacing-8/12/16/20/24/32`를 디자인 토큰으로 덮어쓴다는 점을
주의한다. 이 숫자들은 Tailwind 스케일이 아니라 px 토큰이다 (`p-32`는 32px,
`h-16`은 16px). 토큰이 아닌 길이는 `h-[64px]`처럼 임의값으로 쓴다.
