# 네이버 지역검색 API 연동 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장소 검색 화면이 네이버 지역검색 API를 부르고, 고른 결과(상호·지번주소·좌표)가 URL 쿼리를 타고 장소 등록 화면으로 돌아가 검색창·주소·지도 중심에 반영된다.

**Architecture:** 서버 컴포넌트 `/register/place/search`가 `searchLocalPlaces()`를 직접 호출한다(자기 자신에게 HTTP 금지 규칙). 네이버 응답의 지저분한 부분(HTML 태그, 자릿수 불명의 좌표)은 순수 함수 모듈 `parse.ts`가 정리하고, 비밀 키를 아는 코드는 `env.ts`와 `service.ts`까지다. 화면 간 전달은 URL 쿼리 `?name&address&lat&lng`다.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind v4, 네이버 지역검색 API(NCP API Hub), Storybook

**설계 문서:** `docs/superpowers/specs/2026-08-10-naver-local-search-design.md`

## Global Constraints

- 색상·타이포·스페이싱은 `src/tokens/*`와 `type-*` 유틸리티만. 하드코딩 금지. (`CLAUDE.md`)
- UI는 `src/components/ui/*`를 재사용한다. 신규 구현·복제 금지. (`CLAUDE.md`)
- 페이지에서 `max-w`·좌우 패딩 직접 사용 금지. 폭은 `PageContainer`가 정한다. (`CLAUDE.md`)
- 비밀값은 서버 전용. `NEXT_PUBLIC_` 접두사 금지. (`CLAUDE.md`)
- 서버 컴포넌트는 BFF 계층 함수를 직접 호출한다. 자기 자신에게 HTTP 요청 금지. (`CLAUDE.md`)
- 새 API를 쓰기 전 `node_modules/next/dist/docs/`를 확인한다. (`AGENTS.md`)
- 엔드포인트: `https://naverapihub.apigw.ntruss.com/search/v1/local`
- 인증 헤더: `X-NCP-APIGW-API-KEY-ID`, `X-NCP-APIGW-API-KEY`
- `display`는 1~5, **기본값 1**. 반드시 `display=5`를 명시한다.
- `mapx`=경도, `mapy`=위도. 한국 범위: 위도 33~39, 경도 124~132.
- 주소 기본값 상수는 이미 있다: `PLACE_PENDING_ADDRESS` (`src/lib/places/dto.ts`).
- 지도 기본 중심 상수도 이미 있다: `SEOUL_CITY_HALL` (`src/components/ui/NaverMap.tsx`).
- 테스트 러너가 없다. 검증은 `npx tsc --noEmit`, `npm run lint`, 브라우저, Storybook.
- 작업 브랜치는 `feat/naver-local-search`다.

---

### Task 1: 파싱 모듈, 환경변수, 검색 서비스

네이버 응답을 우리 DTO로 바꾸는 계층 전부. 화면은 아직 건드리지 않는다.

**Files:**
- Create: `src/lib/local-search/parse.ts`
- Create: `src/lib/local-search/dto.ts`
- Create: `src/lib/local-search/env.ts`
- Create: `src/lib/local-search/service.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `LocalSearchResult { name: string; address: string; roadAddress: string; lat: number | null; lng: number | null }` (`./dto`)
  - `stripHtml(value: string): string` (`./parse`)
  - `toDegrees(raw: string | undefined, min: number, max: number): number | null` (`./parse`)
  - `parseLatLng(rawLat: unknown, rawLng: unknown): { lat: number; lng: number } | null` (`./parse`)
  - `KOREA_BOUNDS` (`./parse`)
  - `searchLocalPlaces(query: string): Promise<LocalSearchResult[]>` (`./service`)

- [ ] **Step 1: `src/lib/local-search/parse.ts` 작성**

`server-only`를 붙이지 않는다. 순수 함수뿐이고, 등록 페이지(서버 컴포넌트)와
검증 스크립트가 같이 쓴다.

```ts
/**
 * 네이버 지역검색 응답의 지저분한 부분을 정리하는 순수 함수들.
 *
 * 비밀 키를 모르는 계층이라 `server-only`를 붙이지 않는다. 등록 화면이 URL
 * 쿼리로 받은 좌표를 검증할 때도 같은 잣대를 써야 하므로 공유한다.
 */

/** 대한민국 대략 경계. 좌표 파싱이 틀렸는지 가리는 체. */
export const KOREA_BOUNDS = {
  minLat: 33,
  maxLat: 39,
  minLng: 124,
  maxLng: 132,
} as const;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/**
 * 상호명에서 HTML을 걷어낸다.
 *
 * 네이버는 검색어를 `<b>오월</b>식당`처럼 감싸서 돌려준다. React가 문자열을
 * 이스케이프하므로 XSS는 아니지만, 그대로 두면 화면에 `<b>`가 글자로 보인다.
 */
export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .trim();
}

/**
 * 좌표 문자열을 도(degree)로. 못 믿을 값이면 null.
 *
 * 문서가 `mapx`/`mapy`를 "WGS84"라고만 하고 자릿수 예시를 플레이스홀더로 남겨
 * 뒀다. 네이버 검색 API는 역사적으로 도×10^7 정수 문자열("1270276240")을
 * 돌려줬으므로 둘 다 받는다.
 *
 * 범위 검사가 핵심이다. 나누기를 잘못하면 지도가 아프리카 앞바다를 자신 있게
 * 가리키는데, 그건 아무도 눈치채지 못하는 조용한 실패다.
 */
export function toDegrees(
  raw: string | undefined,
  min: number,
  max: number,
): number | null {
  if (raw === undefined || raw.trim() === "") return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed === 0) return null;

  const degrees = Math.abs(parsed) > 1000 ? parsed / 1e7 : parsed;
  if (degrees < min || degrees > max) return null;

  return degrees;
}

/**
 * URL 쿼리로 받은 위도·경도 한 쌍. 둘 다 성해야 좌표로 인정한다.
 *
 * 하나만 맞는 좌표는 좌표가 아니다. 반쪽만 반영하면 지도가 엉뚱한 자오선
 * 위를 가리킨다.
 */
export function parseLatLng(
  rawLat: unknown,
  rawLng: unknown,
): { lat: number; lng: number } | null {
  if (typeof rawLat !== "string" || typeof rawLng !== "string") return null;

  const lat = toDegrees(rawLat, KOREA_BOUNDS.minLat, KOREA_BOUNDS.maxLat);
  const lng = toDegrees(rawLng, KOREA_BOUNDS.minLng, KOREA_BOUNDS.maxLng);
  if (lat === null || lng === null) return null;

  return { lat, lng };
}
```

- [ ] **Step 2: 파싱 함수를 실제로 돌려 확인**

테스트 러너가 없으므로 Node의 타입 스트리핑으로 직접 돌린다.

확장자가 `.mts`인 이유: `package.json`에 `"type"` 필드가 없어 `.ts`는 CommonJS로
해석되고 `import` 구문이 깨진다. `.mts`는 항상 ESM이다. 프로젝트 루트에 두는
이유는 상대 경로 import가 풀려야 하기 때문이다.

```bash
cat > parse-check.mts <<'TS'
import { stripHtml, toDegrees, parseLatLng, KOREA_BOUNDS } from "./src/lib/local-search/parse.ts";

const cases: [string, unknown, unknown][] = [
  ["stripHtml 태그", stripHtml("<b>오월</b>식당"), "오월식당"],
  ["stripHtml 엔티티", stripHtml("A&amp;B &#39;C&#39;"), "A&B 'C'"],
  ["10^7 정수 경도", toDegrees("1270276240", KOREA_BOUNDS.minLng, KOREA_BOUNDS.maxLng), 127.027624],
  ["10^7 정수 위도", toDegrees("375653770", KOREA_BOUNDS.minLat, KOREA_BOUNDS.maxLat), 37.565377],
  ["소수 경도", toDegrees("127.027624", KOREA_BOUNDS.minLng, KOREA_BOUNDS.maxLng), 127.027624],
  ["0은 버린다", toDegrees("0", KOREA_BOUNDS.minLng, KOREA_BOUNDS.maxLng), null],
  ["빈 문자열", toDegrees("", KOREA_BOUNDS.minLng, KOREA_BOUNDS.maxLng), null],
  ["undefined", toDegrees(undefined, KOREA_BOUNDS.minLng, KOREA_BOUNDS.maxLng), null],
  ["범위 밖(도쿄 경도)", toDegrees("139.7", KOREA_BOUNDS.minLng, KOREA_BOUNDS.maxLng), null],
  ["쌍 정상", JSON.stringify(parseLatLng("375653770", "1270276240")), JSON.stringify({ lat: 37.565377, lng: 127.027624 })],
  ["쌍 한쪽 결손", parseLatLng("375653770", ""), null],
];

let failed = 0;
for (const [label, actual, expected] of cases) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  actual=${String(actual)} expected=${String(expected)}`);
}
console.log(failed === 0 ? "\nAll passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
TS
node --experimental-strip-types parse-check.mts
rm -f parse-check.mts
```

Expected: 모든 줄 `PASS`, 마지막에 `All passed`, 종료 코드 0.

실패하면 그 줄의 기대값과 실제값을 보고 `parse.ts`를 고친다. 특히 부동소수점
때문에 `1270276240 / 1e7`이 `127.02762399999999`처럼 나오면 비교를 반올림으로
바꾸지 말고 나눗셈 방식을 재검토한다(`1e7` 나눗셈은 정확히 떨어진다).

- [ ] **Step 3: `src/lib/local-search/dto.ts` 작성**

```ts
/**
 * 지역검색 결과 — 화면이 아는 유일한 모양.
 *
 * 네이버 응답 필드를 그대로 쓰지 않는다. `mapx`/`mapy`라는 이름은 x가 경도인지
 * 위도인지 매번 헷갈리게 만들고, 문자열이라 쓰는 쪽이 매번 파싱해야 한다.
 * 경계는 여기다.
 *
 * `id`를 두지 않는 이유: 네이버가 안정적인 식별자를 주지 않고, 화면 간 이동에
 * 필요한 것은 손잡이가 아니라 값 자체다.
 */
export interface LocalSearchResult {
  /** HTML 태그를 벗긴 상호명. */
  name: string;
  /** 지번 주소. 비어 있으면 도로명 주소가 들어온다. */
  address: string;
  /** 도로명 주소. 없으면 빈 문자열. */
  roadAddress: string;
  /** WGS84. 파싱이나 범위 검사에 실패하면 null. */
  lat: number | null;
  lng: number | null;
}
```

- [ ] **Step 4: `src/lib/local-search/env.ts` 작성**

```ts
import "server-only";

/**
 * 네이버 지역검색 API 자격 증명. 서버에서만 읽힌다.
 *
 * 지도 키(`NAVER_MAP_CLIENT_ID`)와 다르다. 그건 스크립트 URL에 실려 브라우저로
 * 나가는 값이라 비밀이 아니지만, 이 둘은 진짜 비밀값이다. `server-only`가
 * 클라이언트 번들로 새는 길을 빌드 단계에서 끊는다.
 *
 * `supabase/env.ts`와 달리 모듈 최상단에서 읽지 않고 함수로 감싼다. 최상단에서
 * 던지면 키가 없는 환경에서 `next build`가 이 모듈을 훑는 것만으로 실패한다.
 * 지연시키면 실제로 검색을 시도할 때만 터진다 — 고쳐야 할 시점에 정확히.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `환경변수 ${name}가 없습니다. .env.example을 참고해 .env.local에 추가하세요.`,
    );
  }
  return value;
}

export function naverSearchCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  return {
    clientId: required(
      "NAVER_SEARCH_CLIENT_ID",
      process.env.NAVER_SEARCH_CLIENT_ID,
    ),
    clientSecret: required(
      "NAVER_SEARCH_CLIENT_SECRET",
      process.env.NAVER_SEARCH_CLIENT_SECRET,
    ),
  };
}
```

- [ ] **Step 5: `src/lib/local-search/service.ts` 작성**

```ts
import "server-only";

import type { LocalSearchResult } from "./dto";
import { naverSearchCredentials } from "./env";
import { KOREA_BOUNDS, stripHtml, toDegrees } from "./parse";

const ENDPOINT = "https://naverapihub.apigw.ntruss.com/search/v1/local";

/** API 상한. 더 큰 값을 보내면 SE02로 거절당한다. 기본값이 1이라 생략하면 안 된다. */
const DISPLAY = 5;

/** 응답 재사용 시간(초). 하루 25,000회 한도를 아끼기 위한 것. */
const REVALIDATE_SECONDS = 3600;

/** 네이버가 돌려주는 항목 중 우리가 쓰는 것만. 나머지는 무시한다. */
interface NaverLocalItem {
  title?: string;
  address?: string;
  roadAddress?: string;
  mapx?: string;
  mapy?: string;
}

interface NaverLocalResponse {
  items?: NaverLocalItem[];
}

/**
 * 네이버 지역검색. 실패하면 던진다 — 부르는 화면이 잡아서 상태를 고른다.
 *
 * 네이버 에러 코드(SE01~SE99)로 분기하지 않는다. 사용자가 할 수 있는 일이
 * "다시 시도" 하나뿐이라 갈라 봐야 문구만 늘어난다. 원인은 로그에 남긴다.
 */
export async function searchLocalPlaces(
  query: string,
): Promise<LocalSearchResult[]> {
  const needle = query.trim();
  if (needle === "") return [];

  const { clientId, clientSecret } = naverSearchCredentials();
  const url = `${ENDPOINT}?query=${encodeURIComponent(needle)}&display=${DISPLAY}`;

  const response = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `네이버 지역검색 실패 (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as NaverLocalResponse;

  return (payload.items ?? []).map(toLocalSearchResult);
}

function toLocalSearchResult(item: NaverLocalItem): LocalSearchResult {
  const address = item.address?.trim() ?? "";
  const roadAddress = item.roadAddress?.trim() ?? "";

  return {
    name: stripHtml(item.title ?? ""),
    // 지번이 비어 오는 항목이 있다. 그때는 도로명이라도 보여 준다.
    address: address !== "" ? address : roadAddress,
    roadAddress,
    lat: toDegrees(item.mapy, KOREA_BOUNDS.minLat, KOREA_BOUNDS.maxLat),
    lng: toDegrees(item.mapx, KOREA_BOUNDS.minLng, KOREA_BOUNDS.maxLng),
  };
}
```

- [ ] **Step 6: `.env.example` 맨 아래에 추가**

```
# 네이버 지역검색 API. NCP 콘솔 > API Hub > Search 이용 신청 후 발급한다.
# 지도 키(NAVER_MAP_CLIENT_ID)와 별개다.
# 이 둘은 진짜 비밀값이다. 서버에서만 읽고 브라우저로 내보내지 않는다.
# 없으면 장소 검색 화면이 500이 된다 — 검색이 그 화면의 존재 이유라 폴백이 없다.
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
```

- [ ] **Step 7: 타입·린트 확인**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 둘 다 에러 없음.

- [ ] **Step 8: 커밋**

```bash
git add src/lib/local-search .env.example
git commit -m "feat: 네이버 지역검색 서비스 계층 추가"
```

---

### Task 2: `NaverMap`에 `center` prop

지도가 서울시청 말고 다른 곳도 볼 수 있게 한다. 화면 배선과 독립이라 따로 뗀다.

**Files:**
- Modify: `src/components/ui/NaverMap.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `NaverMapProps`에 `center?: { lat: number; lng: number }` 추가. 기본값 `SEOUL_CITY_HALL`.

- [ ] **Step 1: props에 `center` 추가**

`NaverMapProps` 인터페이스에서 `clientId` 아래에 넣는다.

```tsx
  /**
   * 지도 중심. 생략하면 서울시청.
   *
   * 고른 장소의 좌표가 없을 때(직접 입력, 좌표 파싱 실패)를 위해 선택값이다.
   */
  center?: { lat: number; lng: number };
```

- [ ] **Step 2: 구조 분해와 `initMap`을 좌표에 반응하게 고친다**

함수 시그니처를 바꾸고,

```tsx
export function NaverMap({
  label,
  clientId,
  center = SEOUL_CITY_HALL,
  className,
}: NaverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);

  // 객체를 그대로 의존성에 넣으면 매 렌더 새 참조라 무한 재생성이 된다.
  const { lat, lng } = center;
```

`initMap` 안의 `center` 줄과 의존성 배열을 바꾼다.

```tsx
      center: new naver.maps.LatLng(lat, lng),
```

```tsx
  }, [lat, lng]);
```

좌표가 바뀌면 `useEffect`의 정리가 지도를 destroy 하고 새 좌표로 다시 만든다.
검색 화면에서 등록 화면으로 오는 것은 라우트 전환이라 컴포넌트가 어차피 새로
마운트되므로, 이 경로는 사실상 거의 타지 않는다. 그래도 맞게 동작한다.

- [ ] **Step 3: 타입·린트 확인**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 둘 다 에러 없음. `react-hooks/exhaustive-deps` 경고가 없어야 한다.

- [ ] **Step 4: 커밋**

```bash
git add src/components/ui/NaverMap.tsx
git commit -m "feat: NaverMap에 center prop 추가"
```

---

### Task 3: 검색 화면을 실제 API로 교체

**Files:**
- Modify: `src/app/register/place/search/page.tsx`

**Interfaces:**
- Consumes: `searchLocalPlaces` (`@/lib/local-search/service`), `LocalSearchResult` (`@/lib/local-search/dto`)
- Produces: `/register/place?name=…&address=…&lat=…&lng=…` 형태의 링크와, `action="/register/place"`인 GET 폼

이 태스크가 끝나면 결과를 눌러 등록 화면으로 갈 수 있지만, 등록 화면은 아직
쿼리를 읽지 않아 기존 목 기본값을 보여 준다. Task 4가 그것을 잇는다.

- [ ] **Step 1: 파일 전체를 아래로 교체**

```tsx
import { AppShell } from "../../../../components/layout/AppShell";
import { FlowTopBar } from "../../../../components/layout/FlowTopBar";
import { PageContainer } from "../../../../components/layout/PageContainer";
import { Button } from "../../../../components/ui/Button";
import { Empty } from "../../../../components/ui/Empty";
import { PlaceResultItem } from "../../../../components/ui/PlaceResultItem";
import { TextField } from "../../../../components/ui/TextField";
import type { LocalSearchResult } from "../../../../lib/local-search/dto";
import { searchLocalPlaces } from "../../../../lib/local-search/service";

/**
 * 장소 검색 — design.pen `04a Place Search - Results`와 `04b Place Search - No Result`.
 *
 * 두 프레임은 같은 화면의 두 상태라 한 라우트다. 검색어는 `?q=`로 들고 다닌다.
 * 상태를 클라이언트에 담지 않으므로 결과 화면을 그대로 공유하거나 새로고침해도
 * 같은 것이 나오고, 자바스크립트 없이도 검색이 돈다.
 *
 * 검색어가 아직 없을 때(주소창으로 바로 들어온 경우)는 비어 있는 검색창만 둔다.
 * "검색 결과가 없어요"는 찾아본 뒤에 할 말이지 시작할 때 할 말이 아니다.
 *
 * 서버 컴포넌트가 `searchLocalPlaces`를 직접 부른다. `/api/...` 라우트를 두고
 * 자기 자신에게 HTTP 요청을 보내지 않는다(CLAUDE.md).
 */
export default async function PlaceSearchPage(
  props: PageProps<"/register/place/search">,
) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const searched = query !== "";

  let results: LocalSearchResult[] = [];
  let failed = false;

  if (searched) {
    try {
      results = await searchLocalPlaces(query);
    } catch (reason) {
      // 네이버 에러 코드를 화면에 노출하지 않는다. 사용자가 할 수 있는 일은
      // 다시 시도뿐이고, 원인은 여기 로그에 남는다.
      console.error("[place-search] 지역검색 호출 실패", reason);
      failed = true;
    }
  }

  return (
    <AppShell tabBar={false}>
      <FlowTopBar backHref="/register/place" title="장소 검색" />

      <PageContainer
        as="main"
        width="form"
        className="flex flex-col gap-4 py-4 md:py-32"
      >
        <h1 className="hidden type-display-sm text-text-default md:block">
          장소 검색
        </h1>

        <form action="/register/place/search" method="get">
          <TextField
            name="q"
            defaultValue={query}
            leadingIcon="search"
            placeholder="장소명 또는 주소를 검색하세요"
            aria-label="장소 검색"
            autoFocus
          />
        </form>

        {failed && (
          <Empty
            icon="triangle-alert"
            title="검색을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
          />
        )}

        {!failed && results.length > 0 && (
          <section aria-label="검색 결과" className="flex flex-col">
            <p className="type-label-md text-text-muted">
              검색 결과 {results.length}
            </p>
            {results.map((place, index) => (
              <PlaceResultItem
                key={`${place.name}-${index}`}
                href={selectedPlaceHref(place)}
                name={place.name}
                address={place.address}
              />
            ))}
          </section>
        )}

        {!failed && searched && results.length === 0 && (
          <>
            <Empty
              icon="search"
              title="검색 결과가 없어요"
              description="찾으시는 장소가 없다면 장소명을 직접 입력해 주세요."
            />

            {/*
              주소 없이 이름만 들고 돌아가는 길. 좌표와 주소는 넘기지 않으므로
              등록 화면이 기본값(등록 대기중 / 서울시청)을 그대로 쓴다.
              역지오코딩이 붙으면 여기서 지도로 위치를 고르게 된다.
            */}
            <form
              action="/register/place"
              method="get"
              className="flex flex-col gap-4"
            >
              <TextField
                name="name"
                label="장소명 직접 입력"
                defaultValue={query}
                placeholder="예) 숨은골목식당"
                helperText="주소 없이 장소명만 등록돼요"
                required
              />
              <Button type="submit" className="w-full">
                이 이름으로 등록하기
              </Button>
            </form>
          </>
        )}
      </PageContainer>
    </AppShell>
  );
}

/**
 * 고른 장소를 등록 화면으로 되돌리는 주소.
 *
 * 좌표가 없는 결과는 `lat`/`lng`를 아예 붙이지 않는다. 빈 값을 실어 보내면
 * 받는 쪽이 "없음"과 "0"을 구분하려고 또 한 번 판단해야 한다.
 */
function selectedPlaceHref(place: LocalSearchResult): string {
  const params = new URLSearchParams({
    name: place.name,
    address: place.address,
  });

  if (place.lat !== null && place.lng !== null) {
    params.set("lat", String(place.lat));
    params.set("lng", String(place.lng));
  }

  return `/register/place?${params.toString()}`;
}
```

- [ ] **Step 2: 타입·린트 확인**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 둘 다 에러 없음.

`Button`에 `className`을 넘길 수 있는지 확인한다. `ButtonProps`는
`ComponentPropsWithoutRef<"button">`을 확장하므로 통과해야 한다. 만약
`buttonAppearance`가 `className`을 무시해 폭이 안 늘어나면 폼 쪽에
`[&>button]:w-full` 대신 `Button`의 `className` 처리 방식을 먼저 읽어 본다.

- [ ] **Step 3: 키 없이 500이 나는지 확인**

`.env.local`에 `NAVER_SEARCH_*`가 없는 상태로 개발 서버를 띄운다.

```bash
npm run dev
```

`/register/place/search`(검색어 없음)를 연다.

Expected: 200. 검색어가 없으면 API를 부르지 않으므로 빈 검색창만 나온다.

`/register/place/search?q=오월`을 연다.

Expected: 500. 서버 로그에 `환경변수 NAVER_SEARCH_CLIENT_ID가 없습니다`가 찍힌다.
이것이 설계가 정한 동작이다 — 검색 화면에서 검색이 죽으면 보여 줄 것이 없다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/register/place/search/page.tsx
git commit -m "feat: 장소 검색을 네이버 지역검색 API로 교체"
```

---

### Task 4: 등록 화면에 선택 반영하고 목 데이터 제거

**Files:**
- Modify: `src/app/register/place/page.tsx`
- Delete: `src/lib/places/search.ts`
- Modify: `src/stories/ui/Handoff.stories.tsx`

**Interfaces:**
- Consumes: `parseLatLng` (`@/lib/local-search/parse`), `PLACE_PENDING_ADDRESS` (`@/lib/places/dto`), `NaverMap`의 `center` prop
- Produces: 없음

- [ ] **Step 1: `src/app/register/place/page.tsx` 전체를 아래로 교체**

```tsx
import { AppShell } from "../../../components/layout/AppShell";
import { FlowTopBar } from "../../../components/layout/FlowTopBar";
import { PageContainer } from "../../../components/layout/PageContainer";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { Card } from "../../../components/ui/Card";
import { NaverMap } from "../../../components/ui/NaverMap";
import { TextField } from "../../../components/ui/TextField";
import { parseLatLng } from "../../../lib/local-search/parse";
import { NAVER_MAP_CLIENT_ID } from "../../../lib/maps/env";
import { PLACE_PENDING_ADDRESS } from "../../../lib/places/dto";

/**
 * 장소 등록 — design.pen `04 Place Register - Location`.
 *
 * 맛집 등록의 "장소 입력하기"에서 들어와, 고른 위치를 확인하고 되돌아가는 화면이다.
 * 장소 검색에서 고른 결과가 `?name`·`?address`·`?lat`·`?lng`로 실려 온다.
 *
 * 상단 검색창은 장식이 아니라 진짜 폼이다. 입력하고 넘기면 `/register/place/search`로
 * 이동한다. 시안이 그린 것과 같은 `TextField`이므로 상태(포커스·에러)도 그대로 따라간다.
 *
 * 없는 값은 기본값 한 벌로 메운다 — 주소는 `PLACE_PENDING_ADDRESS`, 지도는
 * 서울시청. 검색 결과가 없어 이름만 직접 입력하고 돌아온 경우가 이 규칙에
 * 그대로 얹힌다. 별도 분기가 없다.
 *
 * 맛집 등록 폼 자체가 아직 배선 전이라(사진·이름·주소 어느 것도 저장되지 않는다),
 * "이 위치로 등록하기"는 고른 장소를 들고 돌아가지 않고 등록 화면으로만 돌아간다.
 * 폼에 상태가 생기는 시점에 같이 이어 붙일 자리다.
 */
export default async function PlaceRegisterPage(
  props: PageProps<"/register/place">,
) {
  const { name, address, lat, lng } = await props.searchParams;

  const selectedName = typeof name === "string" ? name.trim() : "";
  const selectedAddress =
    typeof address === "string" && address.trim() !== ""
      ? address.trim()
      : PLACE_PENDING_ADDRESS;
  // 좌표는 URL로 들어오므로 손으로 고쳐 넣을 수 있다. 검색 결과와 같은 잣대로 검증한다.
  const center = parseLatLng(lat, lng);

  return (
    <AppShell tabBar={false}>
      <FlowTopBar backHref="/register" title="장소 등록" />

      {/* 고르는 화면이라 폼 폭(640)에서 멈춘다. */}
      <PageContainer
        as="main"
        width="form"
        className="flex flex-col gap-4 py-4 md:py-32"
      >
        <h1 className="hidden type-display-sm text-text-default md:block">
          장소 등록
        </h1>

        {/* GET 폼이라 자바스크립트 없이도 검색 화면으로 넘어간다. */}
        <form action="/register/place/search" method="get">
          <TextField
            name="q"
            defaultValue={selectedName}
            leadingIcon="search"
            placeholder="장소명 또는 주소를 검색하세요"
            aria-label="장소 검색"
          />
        </form>

        {/*
          키는 서버에서만 읽어 prop으로 내려간다. 브라우저로 나가는 지점이 이
          한 줄뿐이라, 키가 어디로 새는지 grep 한 번으로 알 수 있다.
        */}
        <NaverMap
          label={selectedName !== "" ? selectedName : "장소 선택"}
          clientId={NAVER_MAP_CLIENT_ID}
          center={center ?? undefined}
        />

        <Card>
          <p className="type-label-md text-text-brand">선택한 위치</p>
          <h2 className="type-heading-md text-text-default">
            {selectedName !== "" ? selectedName : "장소를 선택해 주세요"}
          </h2>
          <p className="type-body-lg text-text-muted">{selectedAddress}</p>
        </Card>

        <ButtonLink href="/register" className="w-full">
          이 위치로 등록하기
        </ButtonLink>
      </PageContainer>
    </AppShell>
  );
}
```

- [ ] **Step 2: 목 데이터 삭제**

```bash
git rm src/lib/places/search.ts
```

- [ ] **Step 3: 스토리에서 목 의존 제거**

`src/stories/ui/Handoff.stories.tsx`에서 아래 import 줄을 지운다.

```tsx
import { searchPlaces } from "../../lib/places/search";
```

`const sample = restaurants[1];` 바로 아래에 샘플 상수를 넣는다.

```tsx
/**
 * design.pen `04a Place Search - Results`가 그린 5건. 실제 검색은 네이버
 * 지역검색 API가 하지만, Storybook에는 서버가 없어 시안 값을 그대로 둔다.
 */
const PLACE_RESULTS = [
  { name: "오월식당", address: "서울 구로구 디지털로 300" },
  { name: "오월식당 신도림점", address: "서울 구로구 경인로 662" },
  { name: "오월 브런치", address: "서울 구로구 디지털로26길 38" },
  { name: "오월정 한식당", address: "서울 영등포구 도림로 45" },
  { name: "카페 오월", address: "서울 구로구 구로중앙로 152" },
];
```

`PlaceResultItems` 스토리 본문에서 `searchPlaces("오월")`를 쓰는 두 곳을
`PLACE_RESULTS`로 바꾸고, `key`를 `place.id`에서 `place.name`으로 바꾼다.

```tsx
          <p className="type-label-md text-text-muted">
            검색 결과 {PLACE_RESULTS.length}
          </p>
          {PLACE_RESULTS.map((place) => (
            <PlaceResultItem
              key={place.name}
              href="#"
              name={place.name}
              address={place.address}
            />
          ))}
```

- [ ] **Step 4: 목 데이터를 참조하는 곳이 더 없는지 확인**

```bash
grep -rn "places/search" src || echo "남은 참조 없음"
```

Expected: `남은 참조 없음`.

- [ ] **Step 5: 타입·린트 확인**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 둘 다 에러 없음.

- [ ] **Step 6: 키 없이 동작 확인**

```bash
npm run dev
```

1. `/register/place` — 검색창 비어 있음, 카드에 "장소를 선택해 주세요 / 등록 대기중",
   지도는 폴백 도식(지도 키가 없으므로)
2. `/register/place?name=테스트&address=서울시 어딘가&lat=37.5&lng=127.0` —
   검색창에 "테스트", 카드에 주소, 지도 키가 있다면 그 좌표가 중앙
3. `/register/place?name=테스트&lat=999&lng=999` — 좌표가 범위 밖이라 무시되고
   지도는 서울시청. 500이 나면 안 된다

- [ ] **Step 7: Storybook 확인**

```bash
npm run storybook
```

`UI/Handoff` → `Place Result Items`에 5줄이 그대로 뜨는지 본다. 확인 후 끈다.

- [ ] **Step 8: 커밋**

```bash
git add -A src/app/register/place/page.tsx src/lib/places/search.ts src/stories/ui/Handoff.stories.tsx
git commit -m "feat: 고른 장소를 등록 화면에 반영하고 목 데이터 제거"
```

---

## 키를 받은 뒤 할 검증

`NAVER_SEARCH_CLIENT_ID`/`SECRET`과 `NAVER_MAP_CLIENT_ID`가 모두 `.env.local`에
들어간 뒤에만 확인할 수 있는 것들이다. 계획의 태스크에는 넣지 않았다 — 키가
없으면 실행 자체가 불가능해 "실패"와 "미검증"을 구분할 수 없기 때문이다.

1. `/register/place/search?q=오월` — 결과 5건 이하, 상호에 `<b>`가 안 보인다
2. 결과를 고르면 등록 화면으로 돌아가 검색창·주소가 맞고, 지도가 그 좌표를
   중앙에 둔다
3. 결과가 0건인 검색어 — 직접 입력 폼이 뜨고, 제출하면 이름만 채워진 채
   주소는 "등록 대기중", 지도는 서울시청
4. 같은 검색어를 다시 치면 네트워크 탭에 네이버 호출이 다시 안 나간다(캐시)

## 남는 일

- 역지오코딩. 지도를 움직여 중심 좌표를 주소로 바꾸고, 직접 입력 경로가 그
  결과를 쓰게 한다. 이번 작업의 `center` prop과 `parseLatLng`이 그 바탕이다.
- 고른 좌표를 `/register` 등록 폼까지 전달하고 DB에 저장.
- 맛집 상세 미니맵을 저장된 좌표로 그리기.
