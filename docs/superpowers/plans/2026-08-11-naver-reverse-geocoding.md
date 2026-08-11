# 네이버 리버스 지오코딩 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/register/place`에서 지도를 움직이면 바뀐 중심 좌표를 네이버 리버스 지오코딩으로 지번주소로 바꿔 하단 카드에 보여 준다.

**Architecture:** 새 클라이언트 컴포넌트 `PlaceLocationPicker`가 `NaverMap`과 `Card`를 함께 소유하고 `{center, name, address, status}`를 관리한다. 지도가 멈추면(`idle`) BFF Route Handler `/api/geocode/reverse`로 fetch 하고, 그 라우트가 서버 전용 서비스 계층을 통해 네이버를 부른다. API 키는 서버 밖으로 나가지 않는다.

**Tech Stack:** Next.js 16.2.12 (App Router, Turbopack), React 19.2.4, TypeScript 5, Tailwind v4, `@types/navermaps` 3.9.2

설계 문서: `docs/superpowers/specs/2026-08-11-naver-reverse-geocoding-design.md`

## Global Constraints

- 테스트 러너가 없다. 검증은 `npx tsc --noEmit`, `npm run lint`, `.mts` 확인 스크립트, 브라우저로 한다.
- 디자인 SSOT는 Storybook이다. `src/components/foundation/*`, `src/components/ui/*`를 그대로 재사용하고 신규 구현·복제·인라인 스타일을 만들지 않는다.
- 색상·타이포·아이콘·스페이싱은 토큰만 쓴다. 하드코딩 금지. `globals.css`가 `--spacing-8/12/16/20/24/32`를 px 토큰으로 덮어쓰므로 그 숫자들은 Tailwind 스케일이 아니다. 토큰이 아닌 길이는 임의값(`h-[64px]`)으로 쓴다.
- Supabase를 아는 코드는 `src/lib/supabase/*`와 `src/lib/*/service.ts`까지다. Route Handler는 서비스 함수와 DTO만 다룬다.
- 새 Route Handler는 `withRoute`로 감싸고, 성공은 DTO, 실패는 `{ error: { code, message } }`로 답한다.
- 비밀값은 서버 전용 환경변수로만 둔다. `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- 커밋 메시지는 한국어, 기존 이력(`feat: 네이버 지역검색 서비스 계층 추가`)의 결을 따른다.
- 작업 브랜치는 `feat/naver-reverse-geocoding`이다. 이미 체크아웃되어 있다.

## 파일 구조

| 파일 | 상태 | 책임 | Task |
| --- | --- | --- | --- |
| `src/lib/reverse-geocode/format.ts` | 신규 | 네이버 응답 → 지번주소 문자열. 순수 함수, `server-only` 없음 | 1 |
| `scripts/address-check.mts` | 신규 | `format.ts` 확인 스크립트 | 1 |
| `package.json` | 수정 | `check:address` 스크립트 추가 | 1 |
| `src/lib/reverse-geocode/dto.ts` | 신규 | `ReverseGeocodeResult` | 2 |
| `src/lib/reverse-geocode/env.ts` | 신규 | 키 두 개. 지연 검증 | 2 |
| `src/lib/reverse-geocode/service.ts` | 신규 | 네이버 호출·캐시·에러 | 2 |
| `.env.example` | 수정 | 키 두 개 문서화 | 2 |
| `src/app/api/geocode/reverse/route.ts` | 신규 | GET. 권한 → 입력 검증 → 서비스 → DTO | 3 |
| `src/components/ui/NaverMap.tsx` | 수정 | `onCenterChange` prop | 4 |
| `src/components/places/PlaceLocationPicker.tsx` | 신규 | 지도 + 카드 소유, 상태 관리 | 5 |
| `src/app/register/place/page.tsx` | 수정 | Picker로 교체 | 5 |

`format.ts`가 `service.ts`와 분리된 이유: 키를 모르는 순수 함수라 확인 스크립트로 바로 돌릴 수 있다. `src/lib/local-search/`의 `parse.ts`/`service.ts` 분리와 같은 이유다.

---

### Task 1: 지번주소 조립 순수 함수

**Files:**
- Create: `src/lib/reverse-geocode/format.ts`
- Create: `scripts/address-check.mts`
- Modify: `package.json` (scripts에 `check:address` 추가)

**Interfaces:**
- Consumes: 없음 (첫 작업)
- Produces:
  - `formatJibunAddress(result: NaverGeocodeResult | undefined): string | null`
  - `interface NaverGeocodeResult { region?: NaverGeocodeRegion; land?: NaverGeocodeLand }`
  - `interface NaverGeocodeRegion { area1?: NaverGeocodeArea; area2?: NaverGeocodeArea; area3?: NaverGeocodeArea; area4?: NaverGeocodeArea }`
  - `interface NaverGeocodeArea { name?: string }`
  - `interface NaverGeocodeLand { type?: string; number1?: string; number2?: string }`

- [ ] **Step 1: 확인 스크립트를 먼저 쓴다**

`scripts/address-check.mts` 생성:

```ts
/**
 * `src/lib/reverse-geocode/format.ts` 확인 — `npm run check:address`.
 *
 * 이 저장소에는 테스트 러너가 없다. 그런데 주소 조립은 조용히 틀리는 종류의
 * 코드다. 부번을 빠뜨려도 "서울특별시 성동구 성수동2가 315"는 그럴듯해 보인다.
 * 러너를 들이는 대신, Node의 타입 스트리핑으로 바로 돌아가는 확인만 남긴다.
 *
 * 확장자가 `.mts`인 이유: `package.json`에 `"type"`이 없어 `.ts`는 CommonJS로
 * 해석되고 `import` 구문이 깨진다. `scripts/parse-check.mts`와 같다.
 */
import {
  formatJibunAddress,
  type NaverGeocodeResult,
} from "../src/lib/reverse-geocode/format.ts";

const 성수동: NaverGeocodeResult = {
  region: {
    area1: { name: "서울특별시" },
    area2: { name: "성동구" },
    area3: { name: "성수동2가" },
    area4: { name: "" },
  },
  land: { type: "1", number1: "315", number2: "7" },
};

const cases: [string, unknown, unknown][] = [
  ["일반 지번", formatJibunAddress(성수동), "서울특별시 성동구 성수동2가 315-7"],
  [
    "부번 빈 문자열",
    formatJibunAddress({ ...성수동, land: { type: "1", number1: "315", number2: "" } }),
    "서울특별시 성동구 성수동2가 315",
  ],
  [
    "부번 0",
    formatJibunAddress({ ...성수동, land: { type: "1", number1: "315", number2: "0" } }),
    "서울특별시 성동구 성수동2가 315",
  ],
  [
    "임야는 산 접두사",
    formatJibunAddress({ ...성수동, land: { type: "2", number1: "12", number2: "3" } }),
    "서울특별시 성동구 성수동2가 산 12-3",
  ],
  [
    "land 없음 → 행정구역까지",
    formatJibunAddress({ region: 성수동.region }),
    "서울특별시 성동구 성수동2가",
  ],
  [
    "본번 없음 → 행정구역까지",
    formatJibunAddress({ ...성수동, land: { type: "1", number1: "", number2: "7" } }),
    "서울특별시 성동구 성수동2가",
  ],
  [
    "area4(리)까지 포함",
    formatJibunAddress({
      region: {
        area1: { name: "전라남도" },
        area2: { name: "광양시" },
        area3: { name: "광양읍" },
        area4: { name: "읍내리" },
      },
      land: { type: "1", number1: "33", number2: "" },
    }),
    "전라남도 광양시 광양읍 읍내리 33",
  ],
  ["공백만 있는 이름은 버린다", formatJibunAddress({ region: { area1: { name: "  " } } }), null],
  ["전부 빈 응답", formatJibunAddress({}), null],
  ["undefined", formatJibunAddress(undefined), null],
];

let failed = 0;
for (const [label, actual, expected] of cases) {
  const ok = actual === expected;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}  actual=${String(actual)} expected=${String(expected)}`,
  );
}

console.log(failed === 0 ? "\nAll passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: package.json에 스크립트 추가**

`"check:parse"` 줄 바로 아래에 추가한다:

```json
    "check:address": "node --experimental-strip-types scripts/address-check.mts",
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npm run check:address`
Expected: FAIL — `Cannot find module '.../src/lib/reverse-geocode/format.ts'`

- [ ] **Step 4: format.ts를 구현한다**

`src/lib/reverse-geocode/format.ts` 생성:

```ts
/**
 * 네이버 리버스 지오코딩 응답에서 지번주소 한 줄을 만든다.
 *
 * 비밀 키를 모르는 계층이라 `server-only`를 붙이지 않는다. 순수 함수라
 * `npm run check:address`로 바로 돌려볼 수 있다 — `local-search/parse.ts`와
 * 같은 이유다.
 *
 * 응답 타입을 우리가 쓰는 필드로만 좁혀 적는다. `land.name`과
 * `addition0..4`는 도로명주소(`roadaddr`) 전용이라 없다.
 */

export interface NaverGeocodeArea {
  name?: string;
}

export interface NaverGeocodeRegion {
  area1?: NaverGeocodeArea;
  area2?: NaverGeocodeArea;
  area3?: NaverGeocodeArea;
  area4?: NaverGeocodeArea;
}

export interface NaverGeocodeLand {
  /** "1" 일반, "2" 임야. */
  type?: string;
  /** 본번. */
  number1?: string;
  /** 부번. 없으면 "" 또는 "0"으로 온다. */
  number2?: string;
}

export interface NaverGeocodeResult {
  region?: NaverGeocodeRegion;
  land?: NaverGeocodeLand;
}

/**
 * `서울특별시 성동구 성수동2가 315-7`
 *
 * 번지를 못 만들면 행정구역까지만, 그것도 없으면 `null`이다. 빈 문자열을
 * 주소인 척 돌려주지 않는다 — 카드가 아무 글자 없이 비어 조용한 실패가 된다.
 *
 * `area0`은 쓰지 않는다. 국가 코드("kr")라 주소에 넣을 것이 아니다.
 */
export function formatJibunAddress(
  result: NaverGeocodeResult | undefined,
): string | null {
  if (!result) return null;

  const region = result.region;
  const areas = [region?.area1, region?.area2, region?.area3, region?.area4]
    .map((area) => area?.name?.trim() ?? "")
    .filter((name) => name !== "");

  const landNumber = formatLandNumber(result.land);
  const parts = landNumber === "" ? areas : [...areas, landNumber];

  const joined = parts.join(" ");
  return joined === "" ? null : joined;
}

/** `315-7`, `315`, `산 12-3`. 본번이 없으면 빈 문자열. */
function formatLandNumber(land: NaverGeocodeLand | undefined): string {
  const number1 = land?.number1?.trim() ?? "";
  if (number1 === "") return "";

  const number2 = land?.number2?.trim() ?? "";
  // 임야는 지번 표기가 "산 12-3"이다.
  const prefix = land?.type === "2" ? "산 " : "";
  const sub = number2 !== "" && number2 !== "0" ? `-${number2}` : "";

  return `${prefix}${number1}${sub}`;
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npm run check:address`
Expected: 10줄 모두 PASS, 마지막 줄 `All passed`

- [ ] **Step 6: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

- [ ] **Step 7: 커밋**

```bash
git add src/lib/reverse-geocode/format.ts scripts/address-check.mts package.json
git commit -m "feat: 리버스 지오코딩 지번주소 조립 함수 추가"
```

---

### Task 2: 서비스 계층과 환경변수

**Files:**
- Create: `src/lib/reverse-geocode/dto.ts`
- Create: `src/lib/reverse-geocode/env.ts`
- Create: `src/lib/reverse-geocode/service.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: Task 1의 `formatJibunAddress`, `NaverGeocodeResult`
- Produces:
  - `interface ReverseGeocodeResult { address: string | null }`
  - `reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult>`
  - `naverGeocodeCredentials(): { apiKeyId: string; apiKey: string }`

- [ ] **Step 1: DTO를 만든다**

`src/lib/reverse-geocode/dto.ts` 생성:

```ts
/**
 * 리버스 지오코딩 결과 — 화면이 아는 유일한 모양.
 *
 * `region`/`land` 원본을 내려보내지 않는다. 화면이 쓰는 것은 문자열 한 줄이고,
 * 네이버 응답 구조를 UI가 알게 되면 그건 스키마가 새어 나간 것이다.
 */
export interface ReverseGeocodeResult {
  /** 조립한 지번주소. 좌표는 유효하나 주소를 못 찾으면 null. */
  address: string | null;
}
```

- [ ] **Step 2: 환경변수 접근을 만든다**

`src/lib/reverse-geocode/env.ts` 생성:

```ts
import "server-only";

/**
 * 네이버 리버스 지오코딩 자격 증명. 서버에서만 읽힌다.
 *
 * 지도 키(`NAVER_MAP_CLIENT_ID`)와도, 지역검색 키(`NAVER_SEARCH_*`)와도 다르다.
 * 호스트부터 다르다 — 이쪽은 `maps.apigw.ntruss.com`이다.
 *
 * `local-search/env.ts`와 같이 모듈 최상단이 아니라 함수로 감싼다. 최상단에서
 * 던지면 키가 없는 환경에서 `next build`가 이 모듈을 훑는 것만으로 실패한다.
 * 지연시키면 실제로 조회할 때만 터진다 — 고쳐야 할 시점에 정확히.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `환경변수 ${name}가 없습니다. .env.example을 참고해 .env.local에 추가하세요.`,
    );
  }
  return value;
}

export function naverGeocodeCredentials(): {
  apiKeyId: string;
  apiKey: string;
} {
  return {
    apiKeyId: required(
      "NAVER_GEOCODE_API_KEY_ID",
      process.env.NAVER_GEOCODE_API_KEY_ID,
    ),
    apiKey: required(
      "NAVER_GEOCODE_API_KEY",
      process.env.NAVER_GEOCODE_API_KEY,
    ),
  };
}
```

- [ ] **Step 3: 서비스를 만든다**

`src/lib/reverse-geocode/service.ts` 생성:

```ts
import "server-only";

import type { ReverseGeocodeResult } from "./dto";
import { naverGeocodeCredentials } from "./env";
import { formatJibunAddress, type NaverGeocodeResult } from "./format";

const ENDPOINT = "https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc";

/** 응답 재사용 시간(초). 좌표와 주소의 대응은 사실상 바뀌지 않는다. */
const REVALIDATE_SECONDS = 86400;

/** 요청은 성공했는데 그 좌표에 주소가 없다. 오류가 아니다. */
const NO_RESULTS = 3;

const OK = 0;

interface NaverReverseGeocodeResponse {
  status?: { code?: number; message?: string };
  results?: NaverGeocodeResult[];
}

/**
 * 좌표 → 지번주소. 실패하면 던진다 — Route Handler의 `withRoute`가 500으로 바꾼다.
 *
 * 도로명(`roadaddr`)은 요청하지 않는다. 화면이 지번 하나만 보여 준다.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  const { apiKeyId, apiKey } = naverGeocodeCredentials();

  // coords는 경도,위도(x,y) 순서다. 뒤집어도 API는 에러를 내지 않고 "결과 없음"이나
  // 엉뚱한 주소를 그럴듯하게 돌려준다. 조립은 이 줄 하나에서만 한다.
  const coords = `${lng},${lat}`;
  const url = `${ENDPOINT}?coords=${encodeURIComponent(coords)}&output=json&orders=addr`;

  const response = await fetch(url, {
    headers: {
      "x-ncp-apigw-api-key-id": apiKeyId,
      "x-ncp-apigw-api-key": apiKey,
    },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `네이버 리버스 지오코딩 실패 (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as NaverReverseGeocodeResponse;
  const code = payload.status?.code;

  if (code === NO_RESULTS) return { address: null };
  if (code !== OK) {
    throw new Error(
      `네이버 리버스 지오코딩 오류 (code ${String(code)}): ${payload.status?.message ?? ""}`,
    );
  }

  return { address: formatJibunAddress(payload.results?.[0]) };
}
```

- [ ] **Step 4: .env.example에 키를 추가한다**

파일 맨 끝에 붙인다:

```
# 네이버 리버스 지오코딩 API. NCP 콘솔 > Maps 이용 신청 후 발급한다.
# 지역검색 키(NAVER_SEARCH_*)와도, 브라우저 지도 키(NAVER_MAP_CLIENT_ID)와도 다르다.
# 호스트부터 다르다 — 이쪽은 maps.apigw.ntruss.com이다.
# 진짜 비밀값이다. 서버에서만 읽고 브라우저로 내보내지 않는다.
# 없으면 지도를 움직여도 주소 자리가 "주소를 불러오지 못했어요"에 머문다.
NAVER_GEOCODE_API_KEY_ID=
NAVER_GEOCODE_API_KEY=
```

**값을 채우지 않는다.** 실제 값은 `.env.local`에만 들어간다.

- [ ] **Step 5: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

- [ ] **Step 6: 커밋**

```bash
git add src/lib/reverse-geocode/dto.ts src/lib/reverse-geocode/env.ts src/lib/reverse-geocode/service.ts .env.example
git commit -m "feat: 네이버 리버스 지오코딩 서비스 계층 추가"
```

---

### Task 3: BFF Route Handler

**Files:**
- Create: `src/app/api/geocode/reverse/route.ts`

**Interfaces:**
- Consumes: Task 2의 `reverseGeocode`, `ReverseGeocodeResult`. 기존 `withRoute`/`jsonOk`/`ValidationError`(`@/lib/api/http`), `requireUser`(`@/lib/auth/session`), `parseLatLng`(`@/lib/local-search/parse`)
- Produces: `GET /api/geocode/reverse?lat=&lng=` → `ReverseGeocodeResult`

- [ ] **Step 1: 라우트를 만든다**

`src/app/api/geocode/reverse/route.ts` 생성:

```ts
import { jsonOk, ValidationError, withRoute } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { parseLatLng } from "@/lib/local-search/parse";
import type { ReverseGeocodeResult } from "@/lib/reverse-geocode/dto";
import { reverseGeocode } from "@/lib/reverse-geocode/service";

/**
 * 좌표 → 지번주소.
 *
 * 지역검색과 달리 라우트가 필요하다. 호출을 일으키는 것이 사용자의 드래그라
 * 클라이언트가 부르고, 키는 서버에만 있어야 하기 때문이다.
 *
 * `requireUser()`로 막는 이유는 이것이 키가 걸린 외부 API로 나가는 통로이기
 * 때문이다. 열어 두면 익명 요청이 할당량을 태울 수 있다. `/register/place`가
 * 이미 로그인을 요구하므로 정상 사용자에게는 차이가 없다.
 *
 * 좌표 검증은 지역검색이 쓰는 `parseLatLng`를 그대로 쓴다. 한국 범위를 벗어난
 * 값을 그대로 네이버에 넘기면 할당량만 태우고 쓸모없는 답을 받는다.
 */
export const GET = withRoute(async (request: Request) => {
  await requireUser();

  const { searchParams } = new URL(request.url);
  const center = parseLatLng(searchParams.get("lat"), searchParams.get("lng"));
  if (!center) {
    throw new ValidationError("올바른 좌표(lat, lng)가 필요합니다.");
  }

  const result = await reverseGeocode(center.lat, center.lng);

  return jsonOk<ReverseGeocodeResult>(result);
});
```

- [ ] **Step 2: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

- [ ] **Step 3: 401을 확인한다 (네이버 키 없이도 확인된다)**

개발 서버가 떠 있어야 한다. 떠 있지 않으면 먼저 `npm run dev`.

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/geocode/reverse?lat=37.5666&lng=126.9784"
```
Expected: `401` — curl에는 세션 쿠키가 없다. 권한 확인이 좌표 검증보다 먼저 걸린다는 뜻이다.

Run:
```bash
curl -s "http://localhost:3000/api/geocode/reverse?lat=37.5666&lng=126.9784"
```
Expected: `{"error":{"code":"unauthorized","message":"로그인이 필요합니다."}}`

- [ ] **Step 4: 브라우저에서 400을 확인한다**

로그인된 브라우저 탭에서 주소창에 넣는다:
```
http://localhost:3000/api/geocode/reverse?lat=0&lng=0
```
Expected: `{"error":{"code":"invalid_request","message":"올바른 좌표(lat, lng)가 필요합니다."}}`

`0,0`은 `KOREA_BOUNDS`(위도 33~39, 경도 124~132) 밖이라 `parseLatLng`가 `null`을 준다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/geocode/reverse/route.ts
git commit -m "feat: 리버스 지오코딩 BFF 라우트 추가"
```

---

### Task 4: NaverMap에 onCenterChange 추가

**Files:**
- Modify: `src/components/ui/NaverMap.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `NaverMapProps.onCenterChange?: (center: { lat: number; lng: number }) => void`

- [ ] **Step 1: props에 콜백을 추가한다**

`NaverMapProps`의 `center` 아래, `className` 위에 넣는다:

```ts
  /**
   * 지도가 멈출 때(`idle`) 바뀐 중심 좌표. 사용자가 움직였을 때만 불린다.
   *
   * 지도 생성 시점에도 `idle`이 한 번 발생하는데, 그때는 좌표가 초기값과 같아
   * 걸러진다. 이게 없으면 화면이 열리자마자 "위치를 옮겼다"고 오해한다.
   */
  onCenterChange?: (center: { lat: number; lng: number }) => void;
```

시그니처에도 추가한다:

```ts
export function NaverMap({
  label,
  clientId,
  center = SEOUL_CITY_HALL,
  onCenterChange,
  className,
}: NaverMapProps) {
```

- [ ] **Step 2: ref 두 개를 추가한다**

`const [failed, setFailed] = useState(false);` 바로 아래에 넣는다:

```ts
  /**
   * 콜백을 ref로 들고 있는 이유: `initMap`의 의존성에 넣으면 부모가 다시 그릴
   * 때마다 함수 정체성이 바뀌어 지도가 통째로 다시 만들어진다. 부모에게
   * `useCallback`을 강요하는 대신 여기서 흡수한다.
   */
  const onCenterChangeRef = useRef(onCenterChange);
  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  /** 마지막으로 보고한 좌표. 초기값이 초기 중심이라 생성 시점 `idle`이 걸러진다. */
  const lastReportedRef = useRef({ lat: center.lat, lng: center.lng });

  const listenerRef = useRef<naver.maps.MapEventListener | null>(null);
```

ref 갱신을 렌더 중이 아니라 `useEffect`에서 하는 이유: 렌더 도중의 ref 쓰기는 React가 권하지 않는다. `useRef(onCenterChange)`가 첫 렌더의 값을 이미 담고 있으므로 이후 갱신만 effect가 맡으면 빈틈이 없다.

주의: `center`는 아래에서 `const { lat, lng } = center;`로 분해되므로, 이 세 줄은 그 분해보다 **위**에 둔다. `center.lat`/`center.lng`로 직접 읽는다.

- [ ] **Step 3: initMap 끝에 리스너를 단다**

`initMap` 안에서 `mapRef.current = new naver.maps.Map(...)` 대입이 끝난 직후, 기존 주석(`// 좌표가 바뀌면 …`) 위에 넣는다:

```ts
    // 지도를 새로 만들면 기준점도 새 중심이다. 이걸 안 맞추면 부모가 `center`를
    // 바꿔 지도가 다시 만들어졌을 때, 첫 `idle`이 "사용자가 움직였다"로 오인된다.
    lastReportedRef.current = { lat, lng };

    listenerRef.current = naver.maps.Event.addListener(
      mapRef.current,
      "idle",
      () => {
        const nextCenter = mapRef.current?.getCenter();
        // `getCenter()`는 `Point | LatLng` 유니온이다. `Point`의 x/y로도
        // 컴파일되지만 어느 쪽이 위도인지가 코드에 드러나지 않는다 — 뒤집혀도
        // 아무 불평 없이 엉뚱한 곳을 가리키는 종류의 실수다. 이름이 붙은
        // 접근자를 쓰기 위해 좁힌다.
        if (!(nextCenter instanceof naver.maps.LatLng)) return;

        const next = { lat: nextCenter.lat(), lng: nextCenter.lng() };
        const last = lastReportedRef.current;
        if (next.lat === last.lat && next.lng === last.lng) return;

        lastReportedRef.current = next;
        onCenterChangeRef.current?.(next);
      },
    );
```

- [ ] **Step 4: 정리에서 리스너를 뗀다**

`useEffect`의 `return` 블록에서 `mapRef.current?.destroy();` **앞에** 넣는다:

```ts
      if (listenerRef.current) {
        naver.maps.Event.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
```

- [ ] **Step 5: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

`onCenterChange`가 선택 prop이라 `src/stories/ui/Handoff.stories.tsx`의 `NaverMapFallback`은 고치지 않아도 그대로 통과한다.

- [ ] **Step 6: 브라우저에서 콜백이 오는지 확인한다**

`src/app/register/place/page.tsx`의 `<NaverMap ... />`에 임시로 붙인다:

```tsx
          onCenterChange={(c) => console.log("[center]", c)}
```

`page.tsx`는 서버 컴포넌트라 인라인 함수를 클라이언트 컴포넌트에 넘길 수 없다. 이 확인만을 위해 페이지 맨 위에 `"use client";`를 임시로 넣고, 확인이 끝나면 **`"use client";`와 `onCenterChange` 줄을 모두 되돌린다.**

Expected:
- `/register/place`를 열었을 때 콘솔에 `[center]`가 **찍히지 않는다** (생성 시점 `idle`이 걸러진다)
- 지도를 끌어 놓으면 한 번 찍힌다
- 계속 끌면 멈출 때마다 한 번씩 찍힌다

되돌리기: `git checkout -- src/app/register/place/page.tsx`

- [ ] **Step 7: 커밋**

`page.tsx`가 원상복구되었는지 `git status`로 먼저 확인한다.

```bash
git add src/components/ui/NaverMap.tsx
git commit -m "feat: NaverMap에 onCenterChange prop 추가"
```

---

### Task 5: PlaceLocationPicker와 페이지 배선

**Files:**
- Create: `src/components/places/PlaceLocationPicker.tsx`
- Modify: `src/app/register/place/page.tsx`

**Interfaces:**
- Consumes: Task 2의 `ReverseGeocodeResult`, Task 3의 `/api/geocode/reverse`, Task 4의 `onCenterChange`
- Produces: `PlaceLocationPicker` 컴포넌트

- [ ] **Step 1: Picker를 만든다**

`src/components/places/PlaceLocationPicker.tsx` 생성:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ReverseGeocodeResult } from "../../lib/reverse-geocode/dto";
import { Card } from "../ui/Card";
import { NaverMap, SEOUL_CITY_HALL } from "../ui/NaverMap";
import { Skeleton } from "../ui/Skeleton";

/** 좌표는 유효한데 그 자리에 주소가 없다. 바다 한가운데가 그렇다. */
const ADDRESS_NOT_FOUND = "주소를 찾을 수 없어요";

/** 조회 자체가 실패했다. 지도를 조금 움직이면 다시 시도된다. */
const ADDRESS_ERROR = "주소를 불러오지 못했어요";

type AddressStatus = "idle" | "loading" | "error";

export interface PlaceLocationPickerProps {
  /** 검색으로 고른 상호명. 없으면 빈 문자열. */
  initialName: string;
  /** 검색으로 실려 온 지번주소, 또는 기본 문구. */
  initialAddress: string;
  /** 검색으로 실려 온 좌표. 없으면 null이고 서울시청에서 시작한다. */
  initialCenter: { lat: number; lng: number } | null;
  /** NCP Client ID. null이면 지도가 도식으로 폴백한다. */
  clientId: string | null;
  /**
   * 마운트 직후 한 번 조회할지. 검색으로 들어와 `?address`가 있으면 false다.
   *
   * 참이어도 상호명은 지우지 않는다. 이것은 사용자가 움직인 것이 아니다.
   */
  geocodeOnMount: boolean;
}

/**
 * 장소 선택 — 지도와 그 아래 카드를 함께 소유한다.
 *
 * 둘을 한 컴포넌트에 묶는 이유는 상태 주인을 하나로 두기 위해서다. 지도가
 * 가리키는 곳과 카드의 글자가 어긋날 수 없다.
 *
 * 지도에 `center`를 되먹이지 않는다. 사용자가 끌어 놓은 위치를 코드가 다시
 * 밀어 넣으면 지도와 싸우게 된다. `center`는 최초 위치일 뿐이다.
 */
export function PlaceLocationPicker({
  initialName,
  initialAddress,
  initialCenter,
  clientId,
  geocodeOnMount,
}: PlaceLocationPickerProps) {
  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState(initialAddress);
  const [status, setStatus] = useState<AddressStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);

  // 객체를 그대로 의존성에 넣으면 매 렌더 새 참조다. NaverMap과 같은 이유로 푼다.
  const initialLat = initialCenter?.lat ?? SEOUL_CITY_HALL.lat;
  const initialLng = initialCenter?.lng ?? SEOUL_CITY_HALL.lng;

  const loadAddress = useCallback(
    async (center: { lat: number; lng: number }, clearName: boolean) => {
      // 이전 요청을 취소한다. 빠르게 여러 번 끌었을 때 늦게 도착한 옛 응답이
      // 최신 주소를 덮어쓰는 것을 막는다.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (clearName) setName("");
      setStatus("loading");

      try {
        const response = await fetch(
          `/api/geocode/reverse?lat=${center.lat}&lng=${center.lng}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`주소 조회 응답 ${response.status}`);
        }

        const result = (await response.json()) as ReverseGeocodeResult;
        setAddress(result.address ?? ADDRESS_NOT_FOUND);
        setStatus("idle");
      } catch (reason) {
        // 취소된 요청은 실패가 아니다. 더 새로운 요청이 이미 달리고 있으므로
        // 상태를 건드리면 그쪽의 결과를 지운다.
        if (controller.signal.aborted) return;

        console.error("[PlaceLocationPicker] 주소 조회 실패", reason);
        setStatus("error");
      }
    },
    [],
  );

  useEffect(() => {
    if (!geocodeOnMount) return;
    void loadAddress({ lat: initialLat, lng: initialLng }, false);
  }, [geocodeOnMount, initialLat, initialLng, loadAddress]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleCenterChange = useCallback(
    (center: { lat: number; lng: number }) => {
      // 지도를 움직였으면 고른 장소를 벗어난 것이다. 상호명을 그대로 두면
      // "예빈당 성수본점 / 서울특별시 광진구 …"처럼 화면이 거짓말을 한다.
      void loadAddress(center, true);
    },
    [loadAddress],
  );

  return (
    <>
      <NaverMap
        label={name !== "" ? name : "장소 선택"}
        clientId={clientId}
        center={{ lat: initialLat, lng: initialLng }}
        onCenterChange={handleCenterChange}
      />

      <Card>
        <p className="type-label-md text-text-brand">선택한 위치</p>
        <h2 className="type-heading-md text-text-default">
          {name !== "" ? name : "장소를 선택해 주세요"}
        </h2>
        {status === "loading" ? (
          <Skeleton variant="text" width="60%" height={18} />
        ) : (
          <p className="type-body-lg text-text-muted">
            {status === "error" ? ADDRESS_ERROR : address}
          </p>
        )}
      </Card>
    </>
  );
}
```

- [ ] **Step 2: 페이지를 Picker로 바꾼다**

`src/app/register/place/page.tsx`에서:

import 문에서 `Card`와 `NaverMap`을 지우고 `PlaceLocationPicker`를 넣는다:

```ts
import { AppShell } from "../../../components/layout/AppShell";
import { FlowTopBar } from "../../../components/layout/FlowTopBar";
import { PageContainer } from "../../../components/layout/PageContainer";
import { PlaceLocationPicker } from "../../../components/places/PlaceLocationPicker";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { TextField } from "../../../components/ui/TextField";
import { parseLatLng } from "../../../lib/local-search/parse";
import { NAVER_MAP_CLIENT_ID } from "../../../lib/maps/env";
import { PLACE_PENDING_ADDRESS } from "../../../lib/places/dto";
```

`selectedAddress` 계산을 주소 유무가 드러나는 형태로 바꾼다:

```ts
  const selectedName = typeof name === "string" ? name.trim() : "";
  // 검색으로 들어왔는지의 판정 기준은 `?address`가 비어 있지 않은지 하나다.
  const providedAddress =
    typeof address === "string" ? address.trim() : "";
  const hasProvidedAddress = providedAddress !== "";
  // 좌표는 URL로 들어오므로 손으로 고쳐 넣을 수 있다. 검색 결과와 같은 잣대로 검증한다.
  const center = parseLatLng(lat, lng);
```

기존 `<NaverMap ... />`과 `<Card> ... </Card>` 블록(주석 포함)을 통째로 지우고 이것으로 바꾼다:

```tsx
        {/*
          키는 서버에서만 읽어 prop으로 내려간다. 브라우저로 나가는 지점이 이
          한 줄뿐이라, 키가 어디로 새는지 grep 한 번으로 알 수 있다.
        */}
        <PlaceLocationPicker
          initialName={selectedName}
          initialAddress={
            hasProvidedAddress ? providedAddress : PLACE_PENDING_ADDRESS
          }
          initialCenter={center}
          clientId={NAVER_MAP_CLIENT_ID}
          geocodeOnMount={!hasProvidedAddress}
        />
```

파일 상단 JSDoc의 다음 문단을 갱신한다 — 동작이 바뀌었다:

기존:
```
 * 없는 값은 기본값 한 벌로 메운다 — 주소는 `PLACE_PENDING_ADDRESS`, 지도는
 * 서울시청. 검색 결과가 없어 이름만 직접 입력하고 돌아온 경우가 이 규칙에
 * 그대로 얹힌다. 별도 분기가 없다.
```

바꿀 것:
```
 * 없는 값은 기본값 한 벌로 메운다 — 지도는 서울시청. 주소가 실려 오지 않았으면
 * `PlaceLocationPicker`가 마운트 직후 리버스 지오코딩으로 채운다. 검색 결과가
 * 없어 이름만 직접 입력하고 돌아온 경우가 이 규칙에 그대로 얹힌다.
 *
 * 지도와 카드는 `PlaceLocationPicker`가 함께 소유한다. 지도를 움직이면 주소가
 * 따라 바뀌어야 하므로 둘의 상태 주인이 하나여야 한다.
```

- [ ] **Step 3: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

- [ ] **Step 4: 키 없이 실패 경로를 확인한다**

`.env.local`에 `NAVER_GEOCODE_*`를 아직 넣지 않은 상태여야 한다.

브라우저에서 `/register/place`를 연다.
Expected:
- 주소 자리에 잠깐 Skeleton이 보였다가 "주소를 불러오지 못했어요"로 바뀐다
- 서버 로그에 `환경변수 NAVER_GEOCODE_API_KEY_ID가 없습니다`가 찍힌다
- 지도는 정상적으로 뜨고 드래그도 된다

- [ ] **Step 5: 키를 넣고 성공 경로를 확인한다**

NCP 콘솔에서 발급한 값을 `.env.local`에 넣는다(`.env.example`이 아니다). Next가 `Reload env: .env.local`을 찍는다.

| # | 절차 | 기대 |
| --- | --- | --- |
| 1 | `/register/place` 진입 (검색 없이) | 주소가 서울시청 지번(`서울특별시 중구 태평로1가 31`)으로 채워진다 |
| 2 | 지도를 다른 동네로 끌어 놓음 | Skeleton 뒤 그 위치의 지번주소, 상호명이 "장소를 선택해 주세요"로 되돌아간다 |
| 3 | 빠르게 여러 번 드래그 | 마지막 위치의 주소만 남는다 |
| 4 | `/register/place/search?q=성수동 카페` → "예빈당 성수본점" 선택 | 상호명과 `서울특별시 성동구 성수동2가 315-7`이 그대로 보인다. **네트워크 탭에 `/api/geocode/reverse` 요청이 없어야 한다** |
| 5 | 4에서 지도를 움직임 | 주소가 바뀌고 상호명이 지워진다 |
| 6 | `/register/place?name=오월식당` (주소·좌표 없음) | 상호명 "오월식당"이 남고 서울시청 주소가 채워진다 |

- [ ] **Step 6: Storybook이 여전히 뜨는지 확인한다**

Run: `npm run storybook`
Expected: Handoff 스토리의 `NaverMapFallback`이 도식으로 정상 렌더된다. 확인 후 서버를 끈다.

- [ ] **Step 7: 커밋**

```bash
git add src/components/places/PlaceLocationPicker.tsx src/app/register/place/page.tsx
git commit -m "feat: 지도 이동에 따라 지번주소를 갱신"
```

---

## 완료 조건

- [ ] `npm run check:address` 통과
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run lint` 통과
- [ ] Task 5 Step 5의 6개 시나리오 모두 확인
- [ ] `.env.example`에 값이 아니라 빈 키만 들어 있다
- [ ] `git status`에 임시 디버그 코드(`console.log`, 임시 `"use client"`)가 남아 있지 않다
