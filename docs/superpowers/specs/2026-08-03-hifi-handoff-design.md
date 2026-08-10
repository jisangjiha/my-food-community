# 하이파이 핸드오프: design.pen → Next.js

작성일: 2026-08-03

## 목적

design.pen의 하이파이 화면 5장을 Next.js로 구현한다. 디자인 파일은 360px 모바일만
그려져 있으므로, 핸드오프 과정에서 태블릿·데스크탑까지 확장한다.

## 범위

| 화면 | Pencil 프레임 | 라우트 |
|---|---|---|
| 로그인 | `00 Login Page - Google` (`bluaR`) | `/login` |
| 메인 | `01 Main Page - Hidden Eats` (`eiUDa`) | `/` |
| 상세 | `02 Detail Page - Restaurant` (`i9ye2`) | `/restaurants/[id]` |
| 등록 | `03 Register Page - Error State` (`aacCG`) | `/register` |
| 마이 | `04 My Page - Profile` (`Tstm6`) | `/my` |

`04 My Page - Profile`은 작업 시작 시점에 존재하지 않아 이번 작업에서 Pencil에
새로 디자인했다. 기존 3장의 비주얼 언어와 디자인 시스템 컴포넌트 인스턴스를 그대로
사용했다. `00 Login Page`는 작업 중 사용자가 Pencil에 추가했다.

UI 전용 핸드오프다. 백엔드·인증·지도 API는 범위 밖이며 모든 데이터는
`src/lib/restaurants.ts`의 정적 목 데이터다.

## 반응형 계약

| | 모바일 <768 | md 768 | lg 1024 | xl 1280 | >1280 |
|---|---|---|---|---|---|
| 내비게이션 | 하단 탭 + FAB | 상단 헤더 | 상단 헤더 | 상단 헤더 | — |
| 컨테이너 좌우 여백 | 16 | 24 | 32 | 32 | 32 |
| 피드 그리드 | 1열 | 2열 | 3열 | 4열 | 4열 (고정) |
| 최대 폭 | — | — | — | 1280 | 1280 + 좌우 여백 |

- 폭 규칙은 `src/components/layout/PageContainer.tsx` 한 곳에만 있다.
- 1280을 넘는 영역은 `mx-auto`로 좌우 여백 처리된다.
- 화면별 추가 확장:
  - **상세** — 본문 컬럼 최대 800. lg부터 지도·수정/삭제를 우측 sticky 레일로 분리.
  - **등록** — 폼 컬럼 최대 640. lg부터 지도 미리보기를 우측 sticky로 분리.
  - **로그인** — lg부터 히어로/폼 2단 분할, 최대 1280.
  - **마이** — 프로필·스탯은 최대 800, 글 목록은 메인과 동일한 1280 그리드.

## 구조

```
src/
  app/
    layout.tsx              body에 background-canvas 적용
    page.tsx                메인
    login/page.tsx
    my/page.tsx
    register/page.tsx
    restaurants/[id]/page.tsx
  components/
    layout/                 페이지 셸 (AppShell, SiteHeader, MobileTabBar,
                            PageContainer, nav-items)
    ui/                     신규 UI 컴포넌트 (RestaurantCard, StatTile,
                            MapPreview, ButtonLink, GoogleLoginButton)
    brand/GoogleMark.tsx    Google 4색 G (디자인 시스템 아이콘 아님)
  lib/restaurants.ts        목 데이터
  stories/ui/Handoff.stories.tsx
```

`AppShell`은 `SiteHeader`(md+)와 `MobileTabBar`(모바일)를 함께 렌더링하되 서로
배타적으로 표시하므로, 어떤 폭에서도 내비게이션 표면은 정확히 하나다.

## 디자인 시스템 준수

- 색·타이포·스페이싱·아이콘은 `src/tokens/*`와 `type-*` 유틸리티만 사용한다.
- 기존 `src/components/ui/*`를 그대로 재사용한다. 신규 컴포넌트는 기존 것으로
  표현할 수 없는 패턴만 만들고 `src/stories/ui/Handoff.stories.tsx`에 스토리를
  함께 작성했다.

### 기반 코드에 가한 변경과 이유

1. **`globals.css`의 `type-*`를 `@layer components` → `@utility`로 변경.**
   레이어 컴포넌트 클래스는 variant를 받을 수 없어 `md:type-heading-sm`이
   무시된다. `@utility`로 선언하면 브레이크포인트별 타입 승급이 가능하다.
   선언 값은 동일하다.
2. **`globals.css`의 `body` 규칙을 `@layer base`로 감쌈.**
   레이어 밖 규칙은 특정도와 무관하게 모든 레이어 규칙을 이기므로,
   `bg-background-canvas`가 조용히 무시되고 있었다.
3. **훅을 쓰는 DS 컴포넌트 6개에 `"use client"` 추가**
   (Checkbox/Radio/Select/Switch/TextField/TextArea). `useId`는 서버 컴포넌트에서
   쓸 수 없다. 공개 API는 그대로이므로 기존 스토리는 영향받지 않는다.
4. **`Button`에서 `buttonAppearance()` 추출 + `ButtonLink` 추가.**
   `<a><button>` 중첩 없이 링크형 버튼이 필요했다. 두 컴포넌트가 같은 함수에서
   클래스·박스를 가져오므로 어긋날 수 없다.

### 스페이싱 유틸리티 주의사항

`globals.css`가 `--spacing-8 … --spacing-32`를 디자인 토큰으로 정의하는데, 이는
Tailwind의 0.25rem 스케일을 **해당 숫자에 한해 덮어쓴다**. 즉 `p-32`는 8rem이 아니라
32px 토큰이고, `h-16`은 4rem이 아니라 16px다. 토큰이 아닌 길이는 `h-[64px]`처럼
임의값으로 적어 구분이 드러나게 했다.

## 디자인 파일을 그대로 따른 항목

SSOT는 Storybook과 design.pen이므로, PRD와 다르더라도 디자인을 따랐다.

- 메인 검색창의 라벨·헬퍼는 `enabled:false` → 필드만 렌더.
- 등록 폼 3개 필드의 leading icon `enabled:false`, 소개/후기 헬퍼도 off.
- 상세·등록의 지도 핀은 아이콘 세트에 map-pin이 없어 `search` 글리프를 사용.
- 등록의 "소개 / 후기"는 PRD상 자유 서술이지만 디자인은 1줄 TextField.
- 등록 화면은 디자인에 에러 상태만 존재하므로 에러 상태로 핸드오프.

## 의도적으로 다르게 한 항목

- **하단 바의 홈 인디케이터 pill 제외** — OS 크롬이지 앱 UI가 아니다.
- **하단 탭의 절대 좌표 → flex 분배** — 디자인은 360px 프레임 기준 절대 배치라
  다른 폰 폭에서 깨진다.
- **로그인 히어로 배지 아이콘 14 → 16** — 디자인은 16px 하트 컴포넌트를 14로
  축소해 썼으나, 아이콘 스케일은 16/20/24/32뿐이라 스케일 밖 크기를 만들지 않았다.
- **배지 배경 `#FFFFFFE6` → `background-surface/90`** — 디자인 파일이 하드코딩한
  값이며, 토큰 사용 규칙에 맞췄다. 육안 차이 없음.
- **`맛지도` 탭은 비활성** — 디자인에는 있으나 해당 화면이 범위에 없어, 죽은 링크
  대신 이동하지 않는 항목으로 렌더링한다.

## 검증

- `tsc --noEmit`, `eslint --max-warnings=0`, `next build`, `build-storybook` 통과.
- 5개 라우트 × 390/834/1280/1600 폭에서 가로 스크롤 없음, 1280 상한 유지,
  폭별 내비게이션 표면 1개를 브라우저에서 확인.
