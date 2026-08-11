# 맛집에 지도 정보 붙이기 (BFF + 상세 미니지도)

작성일: 2026-08-11

## 배경

`place` 테이블에는 `name`·`lat`·`lng` 컬럼이 이미 있다(모두 nullable). 그런데 앱은
그 존재를 모른다. `PLACE_SELECT`도 `PlaceRow`도 `PlaceDto`도 네 값을 다루지 않고,
`createPlace`는 `address`를 `PLACE_PENDING_ADDRESS`로 고정한다. 상세 화면의
"미니지도"도 실제 지도가 아니라 `MapCanvas` 도식이다.

지도 정보를 BFF가 읽고 쓰게 만들고, 상세 화면이 그것으로 진짜 지도를 그리게 한다.

이것은 더 큰 작업의 첫 조각이다. 전체는 다음과 같고 이 문서는 **A와 B**만 다룬다.

| | 작업 | 이 문서 |
| --- | --- | --- |
| A | BFF에 `name`/`lat`/`lng`/`address` 추가 | ✅ |
| B | 상세 미니지도를 실제 지도 + 마커로 | ✅ |
| C | 리버스 지오코딩 구현 | 계획 완료(`2026-08-11-naver-reverse-geocoding.md`), 미실행 |
| D | 고른 장소를 `/register`로 전달 | 후속 |
| E | 등록 폼 배선 + 지도 필수 검증 | 후속 (현재 `/register`는 정적 목업) |
| F | 맛집 수정 화면 신설 | 후속 (PATCH 라우트는 있으나 화면이 없음) |

A가 먼저인 이유: E·F가 부를 API가 올바른 모양이어야 한다. B가 A와 함께인 이유:
A의 결과를 눈으로 확인할 수 있는 유일한 화면이 상세이기 때문이다.

## 범위

**한다**

- `PlaceDto`에 지도 정보를 `location`으로 추가하고 `address`를 그 안으로 옮긴다
- `createPlace`/`updatePlace`가 `name`/`address`/`lat`/`lng`를 저장한다
- 지도 정보가 없는 등록·수정 요청을 서버가 400으로 거절한다
- `NaverMap`에 `variant`와 `size`를 추가한다
- 상세 화면이 저장된 좌표로 지도와 마커를 그린다
- `address` 소비처 4곳을 새 모양에 맞춘다

**하지 않는다**

- 스키마 변경(DDL). 컬럼이 이미 있고, 레거시 행 때문에 `NOT NULL`을 걸 수 없다.
- 등록·수정 폼. E·F다. 이 문서가 끝나도 화면에서 지도 정보를 넣을 수단은 없다.
- 리버스 지오코딩. C다.
- 목록 카드에 지도 넣기. 시안에 없다.

## 결정과 근거

### 1. 네 값을 `location` 하나로 묶는다

```ts
export interface PlaceLocation {
  /** 장소명. 네이버 지역검색에서 고른 상호. `title`(글 제목)과 다르다. */
  name: string;
  /** 지번주소. */
  address: string;
  lat: number;
  lng: number;
}
```

"지도 정보는 필수"라는 요구사항은 곧 이 넷이 **모두 있거나 모두 없거나**라는 뜻이다.
평평하게 늘어놓으면 `name`은 있는데 `lat`은 없는 조합을 타입이 허용하고, 화면마다
"네 개가 다 찼나"를 다시 검사하게 된다. 한 번 빠뜨리면 지도가 `undefined` 좌표로
아무 데나 가리킨다.

묶으면 `location !== null` 한 번으로 끝나고, 그 뒤로는 타입이 네 값의 존재를 보장한다.

`name`과 `title`을 헷갈리지 않게 한다. `title`은 글 제목("성수동 인생 파스타"),
`name`은 장소명("예빈당 성수본점")이다. 둘은 다를 수 있고 실제로 다른 경우가 많다.

### 2. `PlaceDto.address`를 `location` 안으로 옮긴다

남겨 두면 `address`가 두 곳에 생긴다. 하나는 최상위, 하나는 `location.address`.
어느 쪽이 진짜인지 코드마다 다르게 판단하기 시작하면 곧 어긋난다.

옮기는 대가로 소비처 3곳이 바뀐다.

| 파일 | 현재 | 바꿀 것 |
| --- | --- | --- |
| `src/app/page.tsx:152` | `place.address` | `place.location?.address ?? PLACE_PENDING_ADDRESS` |
| `src/app/my/page.tsx:150` | `place.address` | 같음 |
| `src/app/restaurants/[id]/page.tsx:38,121` | `place.address` | 같음 |

`src/stories/ui/Handoff.stories.tsx`의 `place.address`(220행)는 `PlaceDto`가 아니라
파일 안에 있는 로컬 목(`PLACE_RESULTS`, 35행)이다. DTO 변경과 무관하므로 건드리지
않는다.

`PLACE_PENDING_ADDRESS`("등록 대기중") 상수는 남긴다. 레거시 행이 목록에서
빈칸으로 보이면 그게 더 나쁘다.

### 3. `location`이 채워지는 조건

```
lat != null && lng != null && name이 비어 있지 않음  →  location
그 밖                                              →  null
```

`address`는 DB 기본값이 있어 항상 값이 있으므로 판정에 넣지 않는다.

좌표만으로 판정하지 않는 이유: 장소명 없이 좌표만 있는 행은 화면에서 "이름 없는
어딘가"가 된다. 넷을 한 세트로 다루기로 한 이상 판정도 세트로 한다.

### 4. 필수 검증은 앱 계층에서 한다

DB에 `NOT NULL`을 걸 수 없다. 기존 행 2건이 `null`이고, 마이그레이션으로 채울
올바른 값이 없다(테스트 데이터다).

`readLocation()`이 `input.ts`에서 막는다. 넷 중 하나라도 없으면 `ValidationError`고
`withRoute`가 400으로 바꾼다. 등록과 수정이 같은 함수를 쓰므로 한쪽만 느슨해질 수 없다.

좌표 검증은 지역검색이 쓰는 `parseLatLng`를 그대로 재사용한다. 한국 범위(위도
33~39, 경도 124~132)를 벗어난 값을 막는다. 폼이 보내는 값이라 믿을 수 없다 —
`0,0`이 들어오면 지도가 기니 만 앞바다를 가리킨다.

### 5. `NaverMap`을 확장한다. 새 컴포넌트를 만들지 않는다

상세용 지도는 읽기 전용에 마커가 필요하다. 지금의 `NaverMap`은 중앙 고정 핀에
드래그 가능한 "고르는 지도"다.

새 컴포넌트로 분리하면 스크립트 로딩(`next/script`), `navermap_authFailure` 훅,
도식 폴백, 높이 붕괴 대응(`h-full w-full`)을 통째로 복제하게 된다. 그건 네 곳에서
따로 썩는다.

| prop | 기본 | 동작 |
| --- | --- | --- |
| `variant="picker"` | ✓ | 현재 동작. `CenterPin`, 드래그·줌·줌컨트롤, `onCenterChange` |
| `variant="static"` | | `naver.maps.Marker`를 중심 좌표에 박는다. 드래그·스크롤줌·핀치줌·키보드·줌컨트롤 모두 끈다. `CenterPin` 없음 |
| `size="lg"` | ✓ | 높이 440px. 폴백 도식도 같은 규격 |
| `size="sm"` | | 높이 150px. 상세 미니지도 |

`size`는 이미 있는 `MAP_CANVAS_SIZES`를 그대로 쓴다. 지금 `"lg"`가 세 군데
하드코딩되어 있다(바깥 높이, `CenterPin`, 폴백 `MapCanvas`). 셋을 한 값에서 뽑는다.

반응형 높이는 지금처럼 `className`으로 덮는다. 상세 화면이 `MapCanvas`에 넘기던
`md:h-[240px] lg:h-[280px]`이 그대로 `NaverMap`으로 간다. 안쪽 지도 컨테이너는
`h-full`이라 바깥 높이를 무엇으로 정하든 따라간다.

마커는 `variant="static"`일 때만 만든다. `picker`에서 마커를 쓰지 않는 이유는
기존 주석에 있다 — 마커는 좌표에 붙어 지도와 함께 움직이는데, 고르는 화면에
필요한 동작은 그 반대다.

### 6. 지도 표시 조건을 주소에서 좌표로 바꾼다

상세 화면은 지금 `place.address !== PLACE_PENDING_ADDRESS`로 지도를 그릴지 정한다.
이것을 `place.location !== null`로 바꾼다.

주소 문자열이 있어도 좌표가 없으면 지도를 그릴 수 없다. 현재 판정은 "주소가 있으면
좌표도 있겠지"라는 가정 위에 서 있는데, 그 가정이 깨지는 행이 실제로 DB에 있다.

## 아키텍처

```
/restaurants/[id]  (서버 컴포넌트)
  ├─ getPlace(id, viewerId)              src/lib/places/service.ts
  │    └─ PlaceDto { …, location: PlaceLocation | null }
  ├─ location !== null → NaverMap variant="static" size="sm" center={location}
  └─ MapPreview address={location?.address ?? PLACE_PENDING_ADDRESS}

POST /api/places, PATCH /api/places/[id]
  └─ readCreatePlaceInput / readUpdatePlaceInput   src/lib/places/input.ts
       └─ readLocation(form)  ← 넷 다 없으면 400
            └─ parseLatLng()                       src/lib/local-search/parse.ts
  └─ createPlace / updatePlace                     src/lib/places/service.ts
       └─ insert/update { name, address, lat, lng }
```

| 파일 | 상태 | 역할 |
| --- | --- | --- |
| `src/lib/places/dto.ts` | 수정 | `PlaceLocation` 신설, `PlaceDto.address` → `location`, 입력 DTO에 `location` |
| `src/lib/places/input.ts` | 수정 | `readLocation()` 신설 |
| `src/lib/places/service.ts` | 수정 | `PLACE_SELECT`·`PlaceRow`·`toDto`·`createPlace`·`updatePlace` |
| `src/components/ui/NaverMap.tsx` | 수정 | `variant`, `size`, 마커 |
| `src/app/restaurants/[id]/page.tsx` | 수정 | 실제 지도, 판정 기준 변경 |
| `src/app/page.tsx` | 수정 | 카드 meta의 주소 경로 |
| `src/app/my/page.tsx` | 수정 | 같음 |
| `src/stories/ui/Handoff.stories.tsx` | 수정 | `static` 변형 스토리 추가 (DTO와 무관) |

### DTO

```ts
export interface PlaceLocation {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface PlaceDto {
  id: string;
  title: string;
  content: string;
  /** 지도 정보. 네 값이 모두 있어야 채워진다. 없는 레거시 행은 null. */
  location: PlaceLocation | null;
  createdAt: string;
  images: PlaceImageDto[];
  author: { id: string; nickname: string; avatarUrl: string | null } | null;
  isMine: boolean;
}

export interface CreatePlaceInput {
  title: string;
  content: string;
  images: File[];
  /** 필수다. 없으면 입력 계층이 400으로 끊는다. */
  location: PlaceLocation;
}

export interface UpdatePlaceInput {
  title: string;
  content: string;
  keepImagePaths: string[];
  images: File[];
  location: PlaceLocation;
}
```

수정에서도 `location`이 필수다. `UpdatePlaceInput`이 "바뀐 것"이 아니라 "최종
상태"라는 기존 규약을 그대로 따른다. 수정 폼은 기존 값을 미리 채워 두면 되고,
서버는 매번 완전한 세트를 받는다.

### 폼 필드

등록·수정 모두 multipart/form-data이므로 지도 정보도 같은 본문에 실린다.

```
name     장소명
address  지번주소
lat      위도 (문자열)
lng      경도 (문자열)
```

`lat`/`lng`가 문자열인 것은 `FormData`의 성질이다. `parseLatLng`가 문자열을 받아
숫자로 바꾸고 범위를 검사한다 — 지역검색이 URL 쿼리를 검증하던 것과 같은 경로다.

`name`과 `address`는 `requireString`으로 읽으므로 길이 상한이 필요하다. `dto.ts`에
상수로 둔다 — 폼이 서버와 같은 제한으로 미리 걸러 줄 수 있어야 하고, 그것이 이미
그 파일이 `PLACE_TITLE_MAX_LENGTH`를 두고 있는 이유다.

```ts
/** 네이버 지역검색 상호명 기준으로 넉넉히. */
export const PLACE_NAME_MAX_LENGTH = 100;
/** 지번주소는 행정구역 + 번지라 길어야 이 정도다. */
export const PLACE_ADDRESS_MAX_LENGTH = 200;
```

## 에러 처리

| 경우 | 응답 | 문구 |
| --- | --- | --- |
| `name` 없음/빈 값 | 400 `invalid_request` | "장소명은(는) 필수입니다." |
| `address` 없음/빈 값 | 400 `invalid_request` | "주소은(는) 필수입니다." |
| `lat`/`lng` 없음, 숫자 아님, 한국 범위 밖 | 400 `invalid_request` | "장소의 좌표가 올바르지 않습니다. 지도에서 위치를 다시 선택해 주세요." |
| 좌표는 있는데 `name`이 없는 기존 행 조회 | 200 | `location: null` — 지도를 그리지 않는다 |

`requireString`을 재사용하므로 앞의 두 문구는 그 함수가 만드는 형식(`…은(는)
필수입니다.`)을 따른다. 좌표만 별도 문구인 이유는 사용자가 취할 행동이 다르기
때문이다 — 글자를 채우는 것이 아니라 지도로 돌아가야 한다.

## 검증

테스트 러너가 없다. `npx tsc --noEmit`, `npm run lint`, Supabase MCP, 브라우저로 갈음한다.

1. 타입·린트 통과
2. Supabase MCP로 살아 있는 테스트 행(`b79e2f0e-…`, "테스트 맛집 A (수정됨)")에
   지도 정보를 채운다 — 예빈당 성수본점, `서울특별시 성동구 성수동2가 315-7`,
   `37.5427538`, `127.0562415`
3. `/restaurants/b79e2f0e-…` → 성수동 지도가 뜨고 마커가 보인다. 주소 줄이 일치한다.
   지도를 드래그해도 움직이지 않는다(읽기 전용)
4. 홈(`/`)과 마이페이지(`/my`) 카드 meta에 주소가 보인다
5. MCP로 `lat`/`lng`를 다시 `null`로 → 상세에서 지도가 사라지고 주소 줄만 "등록
   대기중"으로 남는다. 확인 후 2의 값으로 되돌린다
6. 로그인 상태에서 지도 정보 없이 등록 시도 → 400과 위 문구

   ```bash
   curl -i -X POST http://localhost:3000/api/places \
     -F title=제목 -F content=열자이상의내용입니다 -F images=@some.jpg
   ```

   (쿠키가 없으면 401이 먼저 나온다. 401 확인만으로도 라우트가 살아 있음은 알 수 있고,
   400 확인은 브라우저 개발자도구에서 fetch로 하는 편이 쉽다)
7. 좌표를 한국 범위 밖(`lat=0&lng=0`)으로 보내면 400
8. Storybook에서 `NaverMapFallback`과 새 `static` 스토리가 모두 뜬다

## 후속

- C: 리버스 지오코딩 구현. 계획 문서가 이미 있다.
- D+E: 고른 장소를 `/register`로 전달하고 등록 폼을 배선한다. 이 문서의
  `readLocation`이 그 폼이 맞춰야 할 계약이다.
- F: 맛집 수정 화면. PATCH 라우트와 `UpdatePlaceInput`은 이 문서에서 이미 준비된다.
- 목록 카드에 좌표가 생겼으니 나중에 "내 주변" 정렬을 붙일 수 있다.
