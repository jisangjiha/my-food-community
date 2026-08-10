# 장소 등록 화면 네이버 지도 연동 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/register/place`의 CSS 도식 지도를 네이버 지도로 바꾸고, 핀은 화면 중앙에 고정한 채 지도만 움직이게 한다.

**Architecture:** 서버 컴포넌트 `page.tsx`가 `NAVER_MAP_CLIENT_ID`를 읽어 클라이언트 컴포넌트 `NaverMap`에 prop으로 내린다. `NaverMap`은 `next/script`로 `maps.js`를 받아 지도를 그리고, 그 위에 `pointer-events-none` 오버레이 핀을 얹는다. 키가 없거나 로드·인증이 실패하면 기존 `MapCanvas` 도식으로 되돌린다.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind v4, 네이버 지도 JS API v3, Storybook

**설계 문서:** `docs/superpowers/specs/2026-08-10-naver-map-integration-design.md`

## Global Constraints

- 색상·타이포·스페이싱은 `src/tokens/*`와 `type-*` 유틸리티만 쓴다. 하드코딩 금지. (`CLAUDE.md`)
- 신규 UI 컴포넌트는 `src/components/ui/`에 두고 `src/stories/ui/`에 스토리를 함께 쓴다. (`CLAUDE.md`)
- 기존 컴포넌트를 복제하지 않는다. 재사용이 안 되면 공통 조각으로 뽑는다. (`CLAUDE.md`)
- 비밀값에 `NEXT_PUBLIC_` 접두사를 붙이지 않는다. (`CLAUDE.md`)
- 페이지에서 `max-w`·좌우 패딩을 직접 쓰지 않는다. 폭은 `PageContainer`가 정한다. (`CLAUDE.md`)
- `globals.css`가 `--spacing-8/12/16/20/24/32`를 px 토큰으로 덮어쓴다. 그 외 길이는 임의값 클래스(`h-[440px]`)로 쓴다. (`CLAUDE.md`)
- 이 저장소의 Next.js는 익숙한 버전이 아니다. 새 API를 쓰기 전 `node_modules/next/dist/docs/`를 확인한다. (`AGENTS.md`)
- 지도 중심 좌표: 서울시청 `37.5666103, 126.9783882`, 줌 `16`.
- 스크립트 URL: `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId={clientId}` — 파라미터 이름은 `ncpClientId`가 아니라 `ncpKeyId`다.
- 테스트 러너가 없다. 모든 검증은 `npx tsc --noEmit`, `npm run lint`, 브라우저, Storybook으로 한다.
- 작업 브랜치는 `feat/naver-map`이다.

---

### Task 1: 환경변수와 타입 기반

키를 읽는 자리와 `naver.maps.*` 타입을 먼저 세운다. 이후 태스크가 모두 이것에 기댄다.

**Files:**
- Create: `src/lib/maps/env.ts`
- Modify: `.env.example`
- Modify: `package.json` (devDependency 추가)

**Interfaces:**
- Consumes: 없음
- Produces: `NAVER_MAP_CLIENT_ID: string | null` — `src/lib/maps/env.ts`에서 export. 전역 `naver.maps.*` 타입.

- [ ] **Step 1: `@types/navermaps` 설치**

```bash
npm install --save-dev @types/navermaps@3.9.2
```

`tsconfig.json`에 `types` 배열이 없으므로 설치만 하면 전역 `naver` 네임스페이스가 자동으로 잡힌다. 별도 설정 불필요.

- [ ] **Step 2: `src/lib/maps/env.ts` 작성**

```ts
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
```

- [ ] **Step 3: `.env.example` 맨 아래에 추가**

```
# 네이버 지도 JS API. NCP 콘솔 > Maps > Application에서 발급한 Client ID(Key ID).
# 브라우저에 노출되는 값이라 비밀값이 아니다. 실제 방어선은 NCP 콘솔에 등록한
# "Web 서비스 URL" 허용목록이므로, 배포 도메인과 개발용 주소를 모두 등록한다.
# NEXT_PUBLIC_을 붙이지 않는 이유: 노출 경로를 서버 컴포넌트 한 곳으로 좁히기
# 위해서다. src/lib/maps/env.ts만 이 값을 읽는다.
# 비워 두면 지도 대신 기존 도식이 보인다 — 앱은 정상 동작한다.
NAVER_MAP_CLIENT_ID=
```

- [ ] **Step 4: 타입·린트 확인**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 둘 다 에러 없음.

- [ ] **Step 5: 전역 타입이 실제로 잡히는지 확인**

임시 파일로 확인하고 지운다.

```bash
printf 'const _p: naver.maps.LatLngLiteral = { lat: 0, lng: 0 };\nexport default _p;\n' > src/lib/maps/__typecheck.ts
npx tsc --noEmit
rm src/lib/maps/__typecheck.ts
```

Expected: `npx tsc --noEmit`이 통과한다. 실패하면 `@types/navermaps`가 잡히지 않은 것이므로 `tsconfig.json`의 `include`와 설치 상태를 먼저 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json .env.example src/lib/maps/env.ts
git commit -m "feat: 네이버 지도 API 키 환경변수와 타입 추가"
```

---

### Task 2: `MapCanvas`에서 `CenterPin` 분리

핀 마크업을 두 벌 쓰지 않기 위해 먼저 뽑아낸다. 동작은 그대로인 순수 리팩터라 이 태스크만 따로 되돌릴 수 있다.

**Files:**
- Modify: `src/components/ui/MapCanvas.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `CenterPin({ size }: { size: MapCanvasSize })` — `src/components/ui/MapCanvas.tsx`에서 export. 이미 export 중인 `MapCanvasSize`, `MAP_CANVAS_SIZES`도 Task 3이 그대로 쓴다.

- [ ] **Step 1: `CenterPin`을 `MapCanvas` 함수 위에 추가**

`src/components/ui/MapCanvas.tsx`의 `BLOCKS` 상수 선언 바로 아래, `export function MapCanvas` 위에 넣는다.

```tsx
/**
 * 지도 정중앙에 고정되는 핀. 도식(`MapCanvas`)과 실제 지도(`NaverMap`)가 같은
 * 핀을 쓴다. 시안이 고른 위치를 가운데 두고 지도를 움직이는 방식이라, 핀은
 * 좌표가 아니라 화면에 붙는다.
 *
 * `pointer-events-none`이 핵심이다. 진짜 지도 위에 얹히면 이 요소가 드래그를
 * 가로채 지도 한가운데가 죽은 영역이 된다.
 */
export function CenterPin({ size }: { size: MapCanvasSize }) {
  const spec = MAP_CANVAS_SIZES[size];

  return (
    <span
      className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-background-surface bg-background-brand"
      style={{
        width: spec.pin,
        height: spec.pin,
        boxShadow: "0 4px 12px #00000033",
      }}
      aria-hidden
    >
      <span
        className="rounded-full bg-background-surface"
        style={{ width: spec.dot, height: spec.dot }}
      />
    </span>
  );
}
```

- [ ] **Step 2: `MapCanvas` 본문의 핀 마크업을 호출로 교체**

`MapCanvas` 안의 `{/* 핀은 언제나 정중앙 ... */}` 주석과 그 아래 `<span>...</span>` 블록 전체(현재 `MapCanvas.tsx:81-95`)를 아래 두 줄로 바꾼다.

```tsx
      {/* 핀은 언제나 정중앙 — 시안이 선택한 위치를 가운데 두고 지도를 움직인다. */}
      <CenterPin size={size} />
```

- [ ] **Step 3: 타입·린트 확인**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 둘 다 에러 없음.

- [ ] **Step 4: 도식이 그대로인지 눈으로 확인**

```bash
npm run storybook
```

`UI/Handoff` → `Map Canvases` 스토리에서 sm·lg 두 도식의 핀 위치·크기·그림자가 이전과 같은지 본다. 확인 후 Storybook을 끈다.

Expected: 시각적 변화 없음. 변했다면 `spec.pin`/`spec.dot`/클래스 문자열을 옮기며 흘린 것이 있다.

- [ ] **Step 5: 커밋**

```bash
git add src/components/ui/MapCanvas.tsx
git commit -m "refactor: MapCanvas의 중앙 핀을 CenterPin으로 분리"
```

---

### Task 3: `NaverMap` 컴포넌트와 스토리

**Files:**
- Create: `src/components/ui/NaverMap.tsx`
- Modify: `src/stories/ui/Handoff.stories.tsx`

**Interfaces:**
- Consumes: `CenterPin`, `MAP_CANVAS_SIZES`, `MapCanvas` (`./MapCanvas`)
- Produces: `NaverMap({ label, clientId, className }: NaverMapProps)`, `SEOUL_CITY_HALL`, `DEFAULT_ZOOM` — `src/components/ui/NaverMap.tsx`에서 export

- [ ] **Step 1: `src/components/ui/NaverMap.tsx` 작성**

```tsx
"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { CenterPin, MAP_CANVAS_SIZES, MapCanvas } from "./MapCanvas";

/**
 * 서울시청. 선택한 장소에 좌표가 아직 없어 지도는 늘 여기서 시작한다.
 * 좌표가 생기면 이 상수 대신 장소의 좌표를 받도록 prop을 연다.
 */
export const SEOUL_CITY_HALL = { lat: 37.5666103, lng: 126.9783882 };

/** 건물이 구분되는 축척. */
export const DEFAULT_ZOOM = 16;

declare global {
  interface Window {
    /**
     * 네이버가 인증에 실패하면 직접 부르는 전역 훅. 도메인 미등록이나 키 오타는
     * 네트워크 에러를 내지 않으므로, 이것이 없으면 회색 사각형만 남는다.
     */
    navermap_authFailure?: () => void;
  }
}

export interface NaverMapProps {
  /** 폴백 도식의 대체 텍스트에 들어가는 장소 이름. */
  label: string;
  /** NCP Client ID. `null`이면 도식으로 폴백한다. */
  clientId: string | null;
  className?: string;
}

/**
 * 네이버 지도 — design.pen `04 Place Register - Location`의 `Map`.
 *
 * 핀은 `naver.maps.Marker`가 아니다. 마커는 좌표에 붙어 지도와 함께 움직이는데,
 * 여기 필요한 동작은 그 반대다. 핀은 화면 정중앙에 못 박히고 지도가 그 밑에서
 * 흐른다. 그래서 핀은 지도 위에 얹은 DOM 오버레이다.
 *
 * 키가 없거나 스크립트 로드·인증이 실패하면 기존 `MapCanvas` 도식으로 되돌린다.
 * 지도는 등록 흐름의 한 조각이라, 지도가 죽었다고 화면 전체가 죽으면 안 된다.
 */
export function NaverMap({ label, clientId, className }: NaverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);

  const initMap = useCallback(() => {
    if (mapRef.current || !containerRef.current) return;
    if (typeof naver === "undefined" || !naver.maps) return;

    mapRef.current = new naver.maps.Map(containerRef.current, {
      center: new naver.maps.LatLng(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng),
      zoom: DEFAULT_ZOOM,
      // 지도는 움직여야 한다 — 핀이 고정이므로 위치를 고르는 수단이 이것뿐이다.
      draggable: true,
      pinchZoom: true,
      scrollWheel: true,
      keyboardShortcuts: true,
      zoomControl: true,
      zoomControlOptions: { position: naver.maps.Position.RIGHT_BOTTOM },
      // 등록 화면에 필요 없는 컨트롤. 로고와 저작권은 약관상 지울 수 없다.
      mapDataControl: false,
      scaleControl: false,
    });
  }, []);

  useEffect(() => {
    window.navermap_authFailure = () => {
      console.error(
        "[NaverMap] 네이버 지도 인증 실패. NAVER_MAP_CLIENT_ID 값과 NCP 콘솔의 Web 서비스 URL 등록을 확인하세요.",
      );
      setFailed(true);
    };

    // 스크립트가 이미 받아진 뒤 다시 마운트된 경우를 위해 여기서도 시도한다.
    // `onReady`가 먼저 불렸다면 `initMap`의 가드가 두 번째 생성을 막는다.
    initMap();

    return () => {
      delete window.navermap_authFailure;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [initMap]);

  if (clientId === null || failed) {
    return <MapCanvas label={label} size="lg" className={className} />;
  }

  return (
    // `role="img"`를 쓰지 않는다. 도식과 달리 이 지도는 줌 버튼 같은 포커스 가능한
    // 자식을 갖고, `img` 안의 자식은 보조기술이 무시한다.
    //
    // 대체 텍스트에 `label`을 넣지 않는 것도 의도다. 지도는 아직 선택한 장소가
    // 아니라 서울시청을 보여 준다. 장소 좌표가 붙기 전까지 이름을 말하면 거짓말이다.
    <div
      role="region"
      aria-label="장소 선택 지도"
      className={`relative w-full overflow-hidden rounded-2xl border border-border-default bg-background-subtle ${MAP_CANVAS_SIZES.lg.height} ${className ?? ""}`}
    >
      <div ref={containerRef} className="absolute inset-0" />
      <CenterPin size="lg" />
      <Script
        id="naver-maps"
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`}
        strategy="afterInteractive"
        onReady={initMap}
        onError={() => {
          console.error("[NaverMap] 지도 스크립트를 불러오지 못했습니다.");
          setFailed(true);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: 타입·린트 확인**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 둘 다 에러 없음.

`naver.maps.Position.RIGHT_BOTTOM`에서 타입 에러가 나면 `@types/navermaps`의 `Position` 정의를 열어 실제 멤버 이름을 확인하고 맞춘다.

```bash
grep -n "RIGHT_BOTTOM\|enum Position" node_modules/@types/navermaps/index.d.ts | head
```

- [ ] **Step 3: 스토리 추가**

`src/stories/ui/Handoff.stories.tsx`의 `MapCanvases` 스토리 바로 아래에 넣는다. 파일 상단 import에 `NaverMap`을 추가한다.

```tsx
import { NaverMap } from "../../components/ui/NaverMap";
```

```tsx
/**
 * 장소 등록 화면의 실제 네이버 지도입니다. Storybook에는 서버가 없어 API 키를
 * 내려줄 수 없으므로 여기서는 폴백 상태만 보입니다. 살아 있는 지도는 앱의
 * `/register/place`에서 확인하세요.
 *
 * 핀은 마커가 아니라 화면 중앙에 고정된 오버레이입니다. 지도가 그 밑에서
 * 움직이고, `pointer-events-none` 덕분에 핀 위에서 시작한 드래그도 지도로
 * 전달됩니다.
 */
export const NaverMapFallback: Story = {
  render: () => (
    <Gallery>
      <Specimen
        label="키 없음 — 도식 폴백"
        description="NAVER_MAP_CLIENT_ID가 없거나 스크립트 로드·인증이 실패하면 MapCanvas 도식으로 되돌아갑니다."
      >
        <div className="w-[328px]">
          <NaverMap label="오월식당" clientId={null} />
        </div>
      </Specimen>
    </Gallery>
  ),
};
```

- [ ] **Step 4: Storybook에서 폴백 확인**

```bash
npm run storybook
```

`UI/Handoff` → `Naver Map Fallback`에서 lg 도식이 그려지는지 본다. 확인 후 끈다.

Expected: `Map Canvases`의 lg와 같은 도식. 콘솔에 에러 없음.

- [ ] **Step 5: 타입·린트 재확인 후 커밋**

```bash
npx tsc --noEmit && npm run lint
git add src/components/ui/NaverMap.tsx src/stories/ui/Handoff.stories.tsx
git commit -m "feat: NaverMap 컴포넌트 추가 — 중앙 고정 핀과 도식 폴백"
```

---

### Task 4: 페이지 배선과 실제 확인

**Files:**
- Modify: `src/app/register/place/page.tsx`

**Interfaces:**
- Consumes: `NAVER_MAP_CLIENT_ID` (`src/lib/maps/env.ts`), `NaverMap` (`src/components/ui/NaverMap`)
- Produces: 없음

- [ ] **Step 1: import 교체**

`src/app/register/place/page.tsx:6`의 `MapCanvas` import를 지우고 두 줄을 넣는다. import 순서는 기존 알파벳 정렬을 따른다.

```tsx
import { NaverMap } from "../../../components/ui/NaverMap";
```

```tsx
import { NAVER_MAP_CLIENT_ID } from "../../../lib/maps/env";
```

- [ ] **Step 2: 지도 렌더링 교체**

`src/app/register/place/page.tsx:58`의 아래 줄을

```tsx
        <MapCanvas label={selected.name} size="lg" />
```

이렇게 바꾼다.

```tsx
        {/*
          키는 서버에서만 읽어 prop으로 내려간다. 브라우저로 나가는 지점이
          이 한 줄뿐이라, 키가 어디로 새는지 grep 한 번으로 알 수 있다.
        */}
        <NaverMap label={selected.name} clientId={NAVER_MAP_CLIENT_ID} />
```

- [ ] **Step 3: 페이지 상단 주석 갱신**

`page.tsx`의 파일 주석에 지도가 서울시청 고정이라는 사실을 한 문단 더한다. 기존 문단들 뒤, `*/` 앞에 넣는다.

```
 * 지도는 네이버 지도지만 늘 서울시청을 본다. 장소 데이터에 좌표가 없어 아직
 * 고른 곳을 가리키지 못한다. `src/lib/places/search.ts`에 좌표가 생기면
 * `NaverMap`에 center prop을 열어 이어 붙일 자리다.
```

- [ ] **Step 4: 타입·린트 확인**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 둘 다 에러 없음. `MapCanvas` import를 지우지 않았다면 unused 경고가 난다.

- [ ] **Step 5: 키 없는 상태에서 폴백 확인**

`.env.local`에 `NAVER_MAP_CLIENT_ID`가 없는 상태로 개발 서버를 띄우고 `/register/place`를 연다.

```bash
npm run dev
```

Expected: 기존 도식이 그대로 보이고, 페이지가 500이 나지 않는다. 브라우저 콘솔에 에러 없음.

- [ ] **Step 6: 키를 넣고 실제 지도 확인**

NCP 콘솔에서 발급한 Client ID를 `.env.local`에 넣는다. NCP 콘솔의 Web 서비스 URL에 개발 서버 주소(`http://localhost:3000`, 포트가 밀렸다면 실제 뜬 주소)를 등록해야 한다. 환경변수를 바꿨으므로 개발 서버를 재시작한다.

확인할 것:

1. 타일이 그려지고 서울시청 일대가 보인다
2. 지도를 드래그해도 핀이 정확히 화면 중앙에 남는다
3. **핀 위에서 시작한 드래그도 지도를 움직인다** — 여기가 막히면 `pointer-events-none`이 빠진 것이다
4. 휠·핀치 줌이 되고, 우하단에 줌 컨트롤이 있다
5. `/register`로 갔다가 다시 들어와도 지도가 다시 그려진다 (`onReady` 재실행 확인)
6. 콘솔에 `[NaverMap]` 에러가 없다

키를 일부러 틀리게 넣고 새로고침하면 도식으로 되돌아가고 콘솔에 인증 실패 메시지가 찍혀야 한다. 확인했으면 올바른 키로 되돌린다.

- [ ] **Step 7: 커밋**

```bash
git add src/app/register/place/page.tsx
git commit -m "feat: 장소 등록 화면에 네이버 지도 연결"
```

---

## 남는 일

계획 밖이며, 별도 작업으로 다룬다.

- 장소 좌표. `src/lib/places/search.ts`에 좌표를 넣거나 지오코딩을 붙이면 지도가 고른 장소를 실제로 가리킨다. 그때 `NaverMap`에 `center` prop을 열고, `aria-label`도 장소 이름을 말하도록 되돌린다.
- 드래그한 좌표를 등록 폼으로 전달. 맛집 등록 폼에 상태가 생기는 시점의 일이다.
- 맛집 상세(`/restaurants/[id]`)의 미니맵. 게시글에 좌표가 생긴 뒤에 바꾼다.
