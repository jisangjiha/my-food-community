# 맛집 지도 정보 (BFF + 상세 미니지도) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `place`의 `name`/`address`/`lat`/`lng`를 BFF가 읽고 쓰게 하고, 맛집 상세 화면이 저장된 좌표로 실제 네이버 지도와 마커를 그린다.

**Architecture:** 네 값을 `PlaceLocation` 하나로 묶어 `PlaceDto.location`에 담는다(모두 있거나 모두 없거나). 쓰기 경로는 `input.ts`의 `readLocation()`이 필수로 강제하고, 좌표 검증은 지역검색이 쓰는 `parseLatLng`를 재사용한다. 상세 지도는 새 컴포넌트를 만들지 않고 `NaverMap`에 `variant="static"`과 `size`를 더해 겸하게 한다.

**Tech Stack:** Next.js 16.2.12 (App Router), React 19.2.4, TypeScript 5, Supabase(PostgREST), `@types/navermaps` 3.9.2

설계 문서: `docs/superpowers/specs/2026-08-11-place-map-fields-design.md`

## Global Constraints

- 테스트 러너가 없다. 검증은 `npx tsc --noEmit`, `npm run lint`, Supabase MCP, 브라우저로 한다.
- DDL을 치지 않는다. `name`/`lat`/`lng` 컬럼은 이미 있고 nullable로 둔다. 레거시 행 2건이 `null`이라 `NOT NULL`을 걸 수 없다.
- Supabase를 아는 코드는 `src/lib/supabase/*`와 `src/lib/*/service.ts`까지다. Route Handler와 페이지는 서비스 함수와 DTO만 다룬다.
- 라우트 응답은 성공 시 DTO, 실패 시 `{ error: { code, message } }`.
- 색상·타이포·스페이싱은 토큰만 쓴다. `globals.css`가 `--spacing-8/12/16/20/24/32`를 px 토큰으로 덮어쓰므로 그 숫자들은 Tailwind 스케일이 아니다.
- 컴포넌트 API를 바꾸면 스토리를 같이 갱신한다.
- 커밋 메시지는 한국어.
- 작업 브랜치는 `feat/naver-reverse-geocoding`이다. 이미 체크아웃되어 있다.
- `PlaceLocation`의 판정 규칙은 전 태스크 공통이다: `lat != null && lng != null && name`이 비어 있지 않을 때만 `location`, 그 밖은 `null`.

## 파일 구조

| 파일 | 상태 | 책임 | Task |
| --- | --- | --- | --- |
| `src/lib/places/dto.ts` | 수정 | `PlaceLocation` 신설, `PlaceDto.address` → `location`, 입력 DTO에 `location`, 길이 상수 2개 | 1 |
| `src/lib/places/service.ts` | 수정 | `PLACE_SELECT`·`PlaceRow`·`toDto`·`createPlace`·`updatePlace` | 1 |
| `src/lib/places/input.ts` | 수정 | `readLocation()` 신설 | 1 |
| `src/app/page.tsx` | 수정 | 카드 meta의 주소 경로 | 2 |
| `src/app/my/page.tsx` | 수정 | 같음 | 2 |
| `src/app/restaurants/[id]/page.tsx` | 수정 | 주소 경로 + 실제 지도 + 판정 기준 | 4 |
| `src/components/ui/NaverMap.tsx` | 수정 | `variant`, `size`, 마커 | 3 |
| `src/stories/ui/Handoff.stories.tsx` | 수정 | `static` 변형 스토리 | 3 |

Task 1(BFF)과 Task 2(읽기 소비처)를 나누는 이유: 1이 끝나면 타입 에러가 3곳에 남는데, 그 3곳이 "무엇을 어떻게 고쳐야 하는지"가 자명하고 서로 독립적이다. 리뷰어가 1의 DTO 설계는 받아들이면서 2의 폴백 문구는 거절할 수 있다.

Task 3(컴포넌트)과 Task 4(페이지)를 나누는 이유: 3은 Storybook만으로 검증되고, 4는 DB 데이터가 있어야 검증된다.

---

### Task 1: BFF에 지도 정보 추가

**Files:**
- Modify: `src/lib/places/dto.ts`
- Modify: `src/lib/places/service.ts`
- Modify: `src/lib/places/input.ts`

**Interfaces:**
- Consumes: 기존 `requireString`·`ValidationError`(`@/lib/api/http`), `parseLatLng`(`@/lib/local-search/parse`)
- Produces:
  - `interface PlaceLocation { name: string; address: string; lat: number; lng: number }`
  - `PlaceDto.location: PlaceLocation | null` (`PlaceDto.address`는 사라진다)
  - `CreatePlaceInput.location: PlaceLocation`, `UpdatePlaceInput.location: PlaceLocation`
  - `PLACE_NAME_MAX_LENGTH = 100`, `PLACE_ADDRESS_MAX_LENGTH = 200`

- [ ] **Step 1: dto.ts에 상수와 타입을 추가한다**

`PLACE_PENDING_ADDRESS` 선언 **위**에 상수 두 개를 넣는다:

```ts
/** 장소명 길이 상한. 네이버 지역검색 상호명 기준으로 넉넉히 잡았다. */
export const PLACE_NAME_MAX_LENGTH = 100;

/** 지번주소 길이 상한. 행정구역 + 번지라 길어야 이 정도다. */
export const PLACE_ADDRESS_MAX_LENGTH = 200;
```

`PLACE_PENDING_ADDRESS`의 주석을 바꾼다. 더 이상 "주소 입력을 아직 만들지 않았다"가 아니다:

```ts
/**
 * 지도 정보가 없는 글의 주소 자리에 보여 줄 문구.
 *
 * `place.address`의 DB 기본값도 같은 문구다. 지도 정보가 필수가 되기 전에 들어온
 * 행이 목록에서 빈칸으로 보이지 않게 하려는 것이고, 새 글은 이 값을 쓰지 않는다.
 */
export const PLACE_PENDING_ADDRESS = "등록 대기중";
```

`PlaceImageDto` 아래에 `PlaceLocation`을 넣는다:

```ts
/**
 * 지도 정보 한 벌.
 *
 * 네 값을 따로 두지 않고 묶는 이유: 지도 정보는 필수라서 모두 있거나 모두
 * 없거나다. 흩어 두면 `name`은 있는데 `lat`은 없는 조합을 타입이 허용하고,
 * 화면마다 "네 개가 다 찼나"를 다시 검사하게 된다. 한 번 빠뜨리면 지도가
 * `undefined` 좌표로 아무 데나 가리킨다.
 */
export interface PlaceLocation {
  /** 장소명. 네이버 지역검색에서 고른 상호다. 글 제목(`title`)과 다르다. */
  name: string;
  /** 지번 주소. */
  address: string;
  /** WGS84. */
  lat: number;
  lng: number;
}
```

- [ ] **Step 2: dto.ts의 세 인터페이스를 고친다**

`PlaceDto`에서 `address` 줄을 지우고 `location`을 넣는다:

```ts
export interface PlaceDto {
  id: string;
  title: string;
  content: string;
  /** 지도 정보. 네 값이 모두 있어야 채워진다. 없는 레거시 행은 null. */
  location: PlaceLocation | null;
  /** ISO 8601. 포맷팅은 화면에서 한다. */
  createdAt: string;
  images: PlaceImageDto[];
  author: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  } | null;
  /** 현재 로그인한 사용자가 쓴 글인지. 비로그인이면 false. */
  isMine: boolean;
}
```

`CreatePlaceInput`에 `location`을 넣고 주석의 마지막 문장(“주소는 받지 않는다…”)을 바꾼다:

```ts
/**
 * 등록 폼이 보내는 값.
 *
 * 파일을 직접 받는다. 클라이언트가 Storage에 먼저 올리고 경로만 보내는 방식은
 * 업로드 권한을 브라우저로 내보내는 것이라 CLAUDE.md의 BFF 규칙과 어긋난다.
 * 지도 정보는 필수다 — 없으면 입력 계층이 400으로 끊는다.
 */
export interface CreatePlaceInput {
  title: string;
  content: string;
  images: File[];
  location: PlaceLocation;
}
```

`UpdatePlaceInput`에도 `location: PlaceLocation;`을 마지막 필드로 넣고, 주석에 한 줄 붙인다:

```
 * 지도 정보도 마찬가지다. 수정 폼이 기존 값을 미리 채워 두고, 서버는 매번
 * 완전한 세트를 받는다.
```

- [ ] **Step 3: input.ts에 readLocation을 추가한다**

import에 필요한 것을 더한다:

```ts
import { parseLatLng } from "@/lib/local-search/parse";
```

그리고 `./dto` import에 `PLACE_ADDRESS_MAX_LENGTH`, `PLACE_NAME_MAX_LENGTH`, `type PlaceLocation`을 추가한다.

`readTextFields` 아래에 넣는다:

```ts
/**
 * 지도 정보 한 벌. 하나라도 없으면 던진다.
 *
 * 등록과 수정이 같은 함수를 쓴다. 라우트마다 적으면 한쪽만 느슨해지는 날이 온다.
 *
 * 좌표는 `parseLatLng`로 검증한다 — 지역검색 결과와 같은 잣대다. 폼이 보낸
 * 값이라 믿을 수 없고, `0,0`이 들어오면 지도가 기니 만 앞바다를 가리킨다.
 */
function readLocation(form: FormData): PlaceLocation {
  const fields = { name: form.get("name"), address: form.get("address") };

  const name = requireString(fields, "name", {
    max: PLACE_NAME_MAX_LENGTH,
    label: "장소명",
  });
  const address = requireString(fields, "address", {
    max: PLACE_ADDRESS_MAX_LENGTH,
    label: "주소",
  });

  const coords = parseLatLng(form.get("lat"), form.get("lng"));
  if (!coords) {
    throw new ValidationError(
      "장소의 좌표가 올바르지 않습니다. 지도에서 위치를 다시 선택해 주세요.",
    );
  }

  return { name, address, lat: coords.lat, lng: coords.lng };
}
```

`parseLatLng`는 `unknown`을 받아 `typeof !== "string"`이면 `null`을 주므로, `form.get()`의 `FormDataEntryValue | null`을 그대로 넘겨도 된다.

- [ ] **Step 4: input.ts의 두 리더가 location을 싣게 한다**

```ts
export async function readCreatePlaceInput(
  request: Request,
): Promise<CreatePlaceInput> {
  const form = await readFormData(request);
  const { title, content } = readTextFields(form);
  const location = readLocation(form);
  const images = readFiles(form, "images", IMAGE_FIELD_OPTIONS);

  assertImageCount(images.length);

  return { title, content, location, images };
}

export async function readUpdatePlaceInput(
  request: Request,
): Promise<UpdatePlaceInput> {
  const form = await readFormData(request);
  const { title, content } = readTextFields(form);
  const location = readLocation(form);
  const images = readFiles(form, "images", IMAGE_FIELD_OPTIONS);
  const keepImagePaths = readKeepImagePaths(form);

  // 남긴 사진과 새로 올린 사진을 합친 것이 수정 후의 최종 개수다.
  assertImageCount(keepImagePaths.length + images.length);

  return { title, content, location, keepImagePaths, images };
}
```

- [ ] **Step 5: service.ts의 조회 경로를 고친다**

`PlaceRow`에 세 줄을 더한다:

```ts
interface PlaceRow {
  id: string;
  title: string;
  content: string;
  address: string;
  created_at: string;
  user_id: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
  place_image: { image_path: string }[] | null;
}
```

`PLACE_SELECT`를 바꾼다:

```ts
const PLACE_SELECT =
  "id, title, content, address, created_at, user_id, name, lat, lng, place_image(image_path)";
```

`toDto`에서 `address: row.address,`를 지우고 `location`을 넣는다:

```ts
    location: toLocation(row),
```

그리고 `toDto` 아래에 헬퍼를 추가한다:

```ts
/**
 * 행 → 지도 정보. 네 값이 다 있어야 인정한다.
 *
 * 좌표만으로 판정하지 않는 이유: 장소명 없이 좌표만 있는 행은 화면에서 "이름
 * 없는 어딘가"가 된다. 넷을 한 세트로 다루기로 한 이상 판정도 세트로 한다.
 *
 * `address`는 DB 기본값이 있어 항상 값이 있으므로 판정에 넣지 않는다.
 */
function toLocation(row: PlaceRow): PlaceLocation | null {
  const name = row.name?.trim() ?? "";
  if (name === "" || row.lat === null || row.lng === null) return null;

  return { name, address: row.address, lat: row.lat, lng: row.lng };
}
```

`./dto` import에서 `PLACE_PENDING_ADDRESS`를 빼고 `type PlaceLocation`을 넣는다. (아래 Step 6에서 `PLACE_PENDING_ADDRESS`의 마지막 사용처가 사라진다.)

- [ ] **Step 6: service.ts의 쓰기 경로를 고친다**

`createPlace`의 `insert`에서 하드코딩을 걷어낸다:

```ts
    .insert({
      title: input.title,
      content: input.content,
      name: input.location.name,
      address: input.location.address,
      lat: input.location.lat,
      lng: input.location.lng,
      // 클라이언트가 보낸 user_id를 쓰지 않는다. 남의 이름으로 글을 쓸 수 있게 된다.
      user_id: authorId,
    })
```

`updatePlace`의 `update`도 지도 정보를 함께 쓴다:

```ts
    .update({
      title: input.title,
      content: input.content,
      name: input.location.name,
      address: input.location.address,
      lat: input.location.lat,
      lng: input.location.lng,
    })
```

- [ ] **Step 7: 타입 검사로 남은 소비처를 확인한다**

Run: `npx tsc --noEmit`
Expected: **FAIL** — `place.address` 때문에 3곳에서 에러가 난다:
- `src/app/page.tsx`
- `src/app/my/page.tsx`
- `src/app/restaurants/[id]/page.tsx`

이것이 정상이다. Task 2와 4에서 고친다. 다른 파일에서 에러가 나면 멈추고 원인을 확인한다.

- [ ] **Step 8: 커밋**

타입 에러가 남아 있는 상태로 커밋한다. 이 태스크의 단위는 "BFF 계층"이고, 소비처는 다음 태스크다.

```bash
git add src/lib/places/dto.ts src/lib/places/input.ts src/lib/places/service.ts
git commit -m "feat: 맛집 BFF에 지도 정보(location) 추가"
```

---

### Task 2: 목록 화면의 주소 경로

**Files:**
- Modify: `src/app/page.tsx:152`
- Modify: `src/app/my/page.tsx:150`

**Interfaces:**
- Consumes: Task 1의 `PlaceDto.location`, `PLACE_PENDING_ADDRESS`
- Produces: 없음

- [ ] **Step 1: 홈 목록을 고친다**

`src/app/page.tsx`의 152행 근처:

```tsx
                    meta={`${place.location?.address ?? PLACE_PENDING_ADDRESS} · ${formatPlaceDate(place.createdAt)}`}
```

`PLACE_PENDING_ADDRESS`가 이 파일에 import 되어 있지 않으면 추가한다. 이미 `formatPlaceDate`를 import 하고 있으므로 import 블록 위치는 그것을 따른다.

- [ ] **Step 2: 마이페이지 목록을 고친다**

`src/app/my/page.tsx`의 150행 근처에 같은 변경을 한다. import도 마찬가지다.

- [ ] **Step 3: 타입 검사**

Run: `npx tsc --noEmit`
Expected: FAIL이지만 남은 에러는 `src/app/restaurants/[id]/page.tsx` **하나뿐**이다. 두 목록 파일의 에러가 사라졌는지 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/page.tsx src/app/my/page.tsx
git commit -m "feat: 목록 카드가 location.address를 읽도록 수정"
```

---

### Task 3: NaverMap에 static 변형과 size 추가

**Files:**
- Modify: `src/components/ui/NaverMap.tsx`
- Modify: `src/stories/ui/Handoff.stories.tsx`

**Interfaces:**
- Consumes: 기존 `MAP_CANVAS_SIZES`, `MapCanvas`, `CenterPin`(`./MapCanvas`)
- Produces:
  - `NaverMapProps.variant?: "picker" | "static"` (기본 `"picker"`)
  - `NaverMapProps.size?: MapCanvasSize` (기본 `"lg"`)

- [ ] **Step 1: import와 props를 넓힌다**

import 줄에 `MapCanvasSize` 타입을 더한다:

```ts
import {
  CenterPin,
  MAP_CANVAS_SIZES,
  MapCanvas,
  type MapCanvasSize,
} from "./MapCanvas";
```

`NaverMapProps`의 `center` 아래, `className` 위에 넣는다:

```ts
  /**
   * `picker`는 위치를 고르는 지도다 — 중앙에 고정된 핀 아래로 지도가 흐르고,
   * 드래그·줌으로 위치를 옮긴다.
   *
   * `static`은 이미 정해진 위치를 보여 주는 지도다. 좌표에 마커를 박고 조작을
   * 모두 끈다. 상세 화면의 미니지도가 이것이다.
   */
  variant?: "picker" | "static";
  /** 높이와 폴백 도식의 규격. `sm` 150px, `lg` 440px. */
  size?: MapCanvasSize;
```

시그니처도 바꾼다:

```ts
export function NaverMap({
  label,
  clientId,
  center = SEOUL_CITY_HALL,
  variant = "picker",
  size = "lg",
  className,
}: NaverMapProps) {
```

- [ ] **Step 2: 마커 ref를 추가한다**

`const [failed, setFailed] = useState(false);` 아래에 넣는다:

```ts
  const markerRef = useRef<naver.maps.Marker | null>(null);
```

- [ ] **Step 3: initMap이 variant를 반영하게 한다**

`initMap` 전체를 바꾼다:

```ts
  const initMap = useCallback(() => {
    if (mapRef.current || !containerRef.current) return;
    if (typeof naver === "undefined" || !naver.maps) return;

    const interactive = variant === "picker";
    const position = new naver.maps.LatLng(lat, lng);

    // 지역 변수에 먼저 담는다. `mapRef.current`는 `Map | null`이라 아래 마커
    // 옵션에 그대로 넘기면 좁히기에 기대야 한다.
    const map = new naver.maps.Map(containerRef.current, {
      center: position,
      zoom: DEFAULT_ZOOM,
      // picker에서 지도는 움직여야 한다 — 핀이 고정이라 위치를 고르는 수단이
      // 이것뿐이다. static은 읽기 전용이라 전부 끈다.
      draggable: interactive,
      pinchZoom: interactive,
      scrollWheel: interactive,
      keyboardShortcuts: interactive,
      zoomControl: interactive,
      zoomControlOptions: { position: naver.maps.Position.RIGHT_BOTTOM },
      // 등록 화면에 필요 없는 컨트롤. 로고와 저작권 표기는 약관상 지울 수 없다.
      mapDataControl: false,
      scaleControl: false,
    });
    mapRef.current = map;

    // 마커는 static에만 있다. picker의 핀이 마커가 아닌 이유는 위 주석에 있다 —
    // 마커는 좌표에 붙어 지도와 함께 움직이는데, 고르는 화면에 필요한 동작은
    // 그 반대다.
    if (!interactive) {
      markerRef.current = new naver.maps.Marker({ position, map });
    }
    // 좌표가 바뀌면 아래 effect의 정리가 지도를 destroy 하고 새 좌표로 다시
    // 만든다. 검색 → 등록은 라우트 전환이라 컴포넌트가 어차피 새로 마운트되므로
    // 이 경로는 사실상 거의 타지 않지만, 타도 맞게 동작한다.
  }, [lat, lng, variant]);
```

- [ ] **Step 4: 정리에서 마커를 뗀다**

`useEffect`의 `return` 블록을 바꾼다. 마커를 지도에서 먼저 떼고 지도를 destroy 한다:

```ts
    return () => {
      delete window.navermap_authFailure;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
```

- [ ] **Step 5: 폴백과 렌더에 size·variant를 반영한다**

폴백:

```ts
  if (clientId === null || failed) {
    return <MapCanvas label={label} size={size} className={className} />;
  }
```

바깥 `div`의 높이와 `aria-label`, 그리고 `CenterPin`을 바꾼다:

```tsx
    <div
      role="region"
      aria-label={variant === "picker" ? "장소 선택 지도" : `${label} 위치 지도`}
      className={`relative w-full overflow-hidden rounded-2xl border border-border-default bg-background-subtle ${MAP_CANVAS_SIZES[size].height} ${className ?? ""}`}
    >
```

`<CenterPin size="lg" />` 줄을 조건부로 바꾼다:

```tsx
      {variant === "picker" && <CenterPin size={size} />}
```

`aria-label`을 가르는 이유는 기존 주석(112~116행)이 설명하는 것과 짝을 이룬다. `picker`는 아직 고른 장소가 아니라 이름을 말할 수 없지만, `static`은 이미 정해진 장소를 보여 주므로 이름을 말하는 것이 맞다. 기존 주석 아래에 한 줄 덧붙인다:

```
    // `static`은 반대다 — 좌표가 이미 정해져 있으므로 그곳의 이름을 말한다.
```

- [ ] **Step 6: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: `src/app/restaurants/[id]/page.tsx`의 `place.address` 에러 하나만 남는다(Task 4에서 고친다). `NaverMap.tsx`와 스토리에서는 에러가 없어야 한다.

- [ ] **Step 7: 스토리를 추가한다**

`src/stories/ui/Handoff.stories.tsx`의 `NaverMapFallback` 스토리 안, 기존 `Specimen` 아래에 `Specimen`을 하나 더 넣는다:

```tsx
      <Specimen
        label="static — 상세 미니지도 (폴백)"
        description="variant=static은 좌표에 마커를 박고 조작을 끕니다. 키가 없어 여기서는 sm 규격의 도식으로 보입니다."
      >
        <div className="w-[328px]">
          <NaverMap
            label="예빈당 성수본점"
            clientId={null}
            variant="static"
            size="sm"
          />
        </div>
      </Specimen>
```

`NaverMapFallback` 위의 JSDoc에 한 줄 덧붙인다:

```
 * `variant="static"`은 상세 화면용입니다. 마커와 읽기 전용 지도라 살아 있는
 * 모습은 앱의 `/restaurants/{id}`에서 확인하세요.
```

- [ ] **Step 8: Storybook으로 확인한다**

Run: `npm run storybook`
Expected: Handoff 스토리에 도식 두 개가 뜬다. 위는 440px(lg), 아래는 150px(sm). 아래쪽에는 중앙 핀이 없다 — `MapCanvas` 폴백은 `variant`를 모르므로 두 도식 모두 핀이 있는 것이 정상이다. **핀 유무가 아니라 높이 차이로 `size`가 먹었는지 확인한다.** 확인 후 서버를 끈다.

- [ ] **Step 9: 커밋**

```bash
git add src/components/ui/NaverMap.tsx src/stories/ui/Handoff.stories.tsx
git commit -m "feat: NaverMap에 static 변형과 size prop 추가"
```

---

### Task 4: 상세 화면에 실제 지도 붙이기

**Files:**
- Modify: `src/app/restaurants/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `PlaceDto.location`, Task 3의 `NaverMap variant`/`size`
- Produces: 없음

- [ ] **Step 1: import를 바꾼다**

`MapCanvas` import를 지우고 `NaverMap`과 지도 키를 넣는다:

```ts
import { MapPreview } from "../../../components/ui/MapPreview";
import { NaverMap } from "../../../components/ui/NaverMap";
import { NotFoundError } from "../../../lib/api/http";
import { getCurrentUser } from "../../../lib/auth/session";
import { NAVER_MAP_CLIENT_ID } from "../../../lib/maps/env";
import { PLACE_PENDING_ADDRESS, type PlaceDto } from "../../../lib/places/dto";
```

(`MapCanvas` 줄만 지우고 `NaverMap`·`NAVER_MAP_CLIENT_ID` 두 줄을 더한다. 나머지 import는 그대로다.)

- [ ] **Step 2: 판정 기준을 좌표로 바꾼다**

38행의 `hasAddress`를 지우고 `location`을 꺼낸다:

```ts
  const [hero, ...rest] = place.images;
  // 지도를 그릴지는 주소 문자열이 아니라 좌표가 정한다. 주소만 있고 좌표가 없는
  // 행이 실제로 있고, 그런 글에 지도를 깔면 화면이 아무 동네나 가리킨다.
  const location = place.location;
```

- [ ] **Step 3: 지도 섹션을 바꾼다**

`<section aria-labelledby="place-location" …>` 안의 주석과 본문을 통째로 바꾼다:

```tsx
        {/*
          위치 — design.pen `02b Detail Page - Map`.

          좌표가 있는 글에만 지도를 그린다. 지도 정보가 필수가 되기 전에 들어온
          행은 `lat`/`lng`가 비어 있어, 그런 글에는 주소 카드만 남는다. 좌표를
          모르는데 지도를 깔면 화면이 아무 동네나 가리키면서 아는 척을 하게 된다.
        */}
        <section aria-labelledby="place-location" className="flex flex-col gap-2">
          <h2 id="place-location" className="type-label-md text-text-brand">
            위치
          </h2>
          {location && (
            <NaverMap
              label={location.name}
              clientId={NAVER_MAP_CLIENT_ID}
              center={{ lat: location.lat, lng: location.lng }}
              variant="static"
              size="sm"
              className="md:h-[240px] lg:h-[280px]"
            />
          )}
          <MapPreview
            address={location?.address ?? PLACE_PENDING_ADDRESS}
            state={location ? "filled" : "empty"}
          />
        </section>
```

`label`에 `place.title`이 아니라 `location.name`을 쓴다. 지도가 가리키는 것은 글이 아니라 장소다.

- [ ] **Step 4: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0). 이제 남은 타입 에러가 없어야 한다.

- [ ] **Step 5: 검증용 데이터를 채운다**

Supabase MCP `execute_sql`로 살아 있는 테스트 행에 지도 정보를 넣는다:

```sql
update public.place
set name = '예빈당 성수본점',
    address = '서울특별시 성동구 성수동2가 315-7',
    lat = 37.5427538,
    lng = 127.0562415
where id = 'b79e2f0e-6666-4807-8c5d-b4568938c3c8';
```

- [ ] **Step 6: 브라우저로 확인한다**

개발 서버가 떠 있어야 한다.

| # | 절차 | 기대 |
| --- | --- | --- |
| 1 | `/restaurants/b79e2f0e-6666-4807-8c5d-b4568938c3c8` | 성수동 지도가 뜨고 **마커**가 보인다. 주소 줄이 `서울특별시 성동구 성수동2가 315-7` |
| 2 | 지도를 드래그·스크롤 | 움직이지 않는다. 줌 버튼도 없다 |
| 3 | 홈 `/` | 카드 meta에 성수동 주소가 보인다 |
| 4 | `/my` | 같음 |

- [ ] **Step 7: 좌표 없는 행의 폴백을 확인한다**

MCP로 좌표만 비운다:

```sql
update public.place set lat = null, lng = null
where id = 'b79e2f0e-6666-4807-8c5d-b4568938c3c8';
```

Expected: 상세에서 지도가 사라지고 주소 줄이 "등록 대기중"(`empty` 상태, 테두리 있는 흐린 글자)으로 바뀐다. 목록 카드도 "등록 대기중".

확인 후 Step 5의 값으로 되돌린다.

- [ ] **Step 8: 지도 정보 없는 등록이 막히는지 확인한다**

로그인된 브라우저 탭의 개발자도구 콘솔에서:

```js
const fd = new FormData();
fd.append("title", "지도 없는 등록");
fd.append("content", "열 자가 넘는 내용입니다");
fd.append("images", new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" }));
const r = await fetch("/api/places", { method: "POST", body: fd });
console.log(r.status, await r.json());
```

Expected: `400 {error: {code: "invalid_request", message: "장소명은(는) 필수입니다."}}`

좌표만 틀린 경우도 확인한다 — 위 스크립트에 다음을 더하고 다시 실행:

```js
fd.append("name", "테스트");
fd.append("address", "서울특별시 성동구");
fd.append("lat", "0");
fd.append("lng", "0");
```

Expected: `400 … "장소의 좌표가 올바르지 않습니다. 지도에서 위치를 다시 선택해 주세요."`

- [ ] **Step 9: 커밋**

```bash
git add src/app/restaurants/\[id\]/page.tsx
git commit -m "feat: 맛집 상세에 저장된 좌표로 지도와 마커 표시"
```

---

## 완료 조건

- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run lint` 통과
- [ ] Task 4 Step 6의 4개 시나리오 확인
- [ ] Task 4 Step 7의 폴백 확인 후 데이터 복구
- [ ] Task 4 Step 8의 400 두 가지 확인
- [ ] Storybook에 `static` 스토리가 뜬다
- [ ] DDL을 치지 않았다 (`supabase/migrations` 변화 없음)
- [ ] `git status`에 임시 디버그 코드가 남아 있지 않다

## 후속

- C: 리버스 지오코딩 (`docs/superpowers/plans/2026-08-11-naver-reverse-geocoding.md`)
- D+E: 고른 장소를 `/register`로 전달하고 등록 폼 배선. 이 계획의 `readLocation`이 폼이 맞춰야 할 계약이다 — 폼 필드 이름은 `name`/`address`/`lat`/`lng`.
- F: 맛집 수정 화면. `UpdatePlaceInput.location`은 이미 준비되어 있다.
