# 네이버 리버스 지오코딩 API 연동

작성일: 2026-08-11

## 배경

`/register/place`는 핀을 화면 정중앙에 못 박고 지도가 그 밑에서 흐르는 방식이다
(`NaverMap`의 `CenterPin`). 그런데 지도를 아무리 움직여도 하단 카드의 주소는
검색으로 들어온 `?address` 그대로다. 핀이 가리키는 곳과 글자가 어긋난다.

지도를 움직이면 바뀐 중심 좌표를 주소로 바꿔 그 자리에 보여 준다.
이전 스펙(`2026-08-10-naver-local-search-design.md`)이 후속으로 지목해 둔 작업이고,
그때 깔아 둔 `center` prop과 좌표 파싱을 그대로 쓴다.

## 범위

**한다**

- 지도가 멈추면 중심 좌표로 리버스 지오코딩을 호출해 하단 주소를 갱신
- 검색 없이 진입한 경우 최초 1회 조회 (핀은 서울시청에 있는데 주소만 비어 있는 상태를 없앤다)
- 지번주소를 행정구역 + 번지까지 조립
- 조회 중 `Skeleton`, 실패 시 문구
- `NaverMap`에 `onCenterChange` prop 추가
- API 키를 `.env.example`로 분리

**하지 않는다**

- 도로명주소(`roadaddr`). 화면이 지번 하나만 보여 주므로 요청도 `orders=addr` 하나만 한다.
- 바뀐 좌표·주소를 `/register` 등록 폼까지 전달하는 배선. 그 폼은 아직 상태가 없다
  (`register/place/page.tsx` 주석). 폼이 배선될 때 같이 붙일 자리다.
- 맛집 상세의 미니맵.
- 주소 검색(정방향 지오코딩).

## 외부 API

```
GET https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc
    ?coords={경도},{위도}&output=json&orders=addr

헤더:
  x-ncp-apigw-api-key-id: {API Key ID}
  x-ncp-apigw-api-key:    {API Key}
```

기존 지역검색과 **호스트도 자격증명도 다르다**. 확인한 값이다:

| 호스트 | 결과 |
| --- | --- |
| `maps.apigw.ntruss.com` | 401 `Authentication Failed` — 엔드포인트 존재, 키만 없음 |
| `naverapihub.apigw.ntruss.com` (지역검색이 쓰는 호스트) | 404 |

브라우저용 `NAVER_MAP_CLIENT_ID`와도 다른 값이다. 그건 스크립트 URL에 실려 나가는
공개 키고, 이쪽은 서버에서만 읽는 비밀값이다.

### 응답에서 쓰는 필드

```
results[0].region.area1..area4[].name   시/도, 시/군/구, 읍/면/동, 리
results[0].land.type                    "1" 일반, "2" 산
results[0].land.number1                 본번
results[0].land.number2                 부번 (없으면 "" 또는 "0")
status.code                             0 성공, 3 결과 없음, 그 외 오류
```

`land.name`과 `addition0..4`는 도로명(`roadaddr`) 전용이라 쓰지 않는다.

## 결정과 근거

### 1. `coords`는 경도,위도 순서다

문서 예시가 `coords=127.585,34.9765`다. 앞이 경도(x), 뒤가 위도(y)다.

뒤집어도 API는 에러를 내지 않는다. 한국 좌표를 뒤집으면 위도 127도라는 존재하지
않는 값이 되어 "결과 없음"이 오거나, 운이 나쁘면 엉뚱한 곳의 주소가 그럴듯하게
온다. 지역검색의 `mapx`/`mapy` 파싱과 같은 종류의 조용한 실패다. 서비스 계층
한 곳에서만 조립하고 주석으로 못 박는다.

### 2. 클라이언트 래퍼가 지도와 카드를 함께 소유한다

새 클라이언트 컴포넌트 `PlaceLocationPicker`가 `NaverMap`과 `Card`를 감싸고
`{center, name, address, status}`를 소유한다. 서버 페이지는 초기값만 내려준다.

대안을 둘 검토했다.

- **Context 프로바이더 + 서버 카드 안에 클라이언트 주소 줄만**: 서버 렌더를 최대한
  지키지만 값 하나 나르자고 프로바이더와 소비자 둘이 생긴다.
- **URL 구동** (`idle` → `router.replace(?lat&lng)` → 서버에서 조회): Route Handler도
  클라이언트 fetch도 필요 없고 주소가 URL에 남아 새로고침·공유에 살아남는다. 하지만
  드래그 한 번마다 페이지 전체 RSC 왕복이 붙는다. 글자 한 줄 바꾸는 값으로는 비싸고,
  드래그가 잦은 화면이라 체감이 둔해진다.

래퍼 방식은 상태 주인이 하나라 지도와 주소가 어긋날 수 없고, 다시 그리는 단위가
실제로 바뀌는 것과 일치한다. URL 방식의 장점("좌표가 URL에 남는다")은 등록 폼이
배선될 때 그 시점에 넘기면 되는 문제라 지금 왕복 비용을 낼 이유가 없다.

카드가 서버 렌더에서 클라이언트로 넘어오지만 내용이 텍스트 세 줄이라 번들 부담은
사실상 없다.

### 3. Route Handler를 만든다

지역검색 때는 만들지 않았다. 서버 컴포넌트가 `?q=`를 받아 직접 부르면 됐기 때문이다.
이번은 반대다. 호출을 일으키는 것이 사용자의 드래그이므로 클라이언트가 부른다.
키는 서버에만 있어야 하니 통로가 필요하다.

`GET /api/geocode/reverse?lat=&lng=` — `withRoute`로 감싸고 성공은 DTO, 실패는
`{ error: { code, message } }`. `CLAUDE.md`의 BFF 규약 그대로다.

### 4. 라우트를 `requireUser()`로 막는다

이 라우트는 키가 걸린 외부 API로 나가는 통로다. 열어 두면 익명 요청이 할당량을
태울 수 있다. `/register/place`가 이미 로그인을 요구하므로(미로그인은 307) 정상
사용자에게는 아무 차이가 없다.

### 5. 지도를 움직이면 상호명을 지운다

검색으로 "예빈당 성수본점"을 고른 뒤 지도를 다른 동네로 끌면, 주소만 바뀌고
상호명이 남아 화면이 "예빈당 성수본점 / 서울특별시 광진구 …"라고 거짓말을 한다.

움직인 순간 고른 장소를 벗어난 것으로 보고 상호명을 빈 값으로 되돌린다. 카드는
`장소를 선택해 주세요`로 돌아가고 주소만 남는다. 다시 검색해서 고르면 상호명이
돌아온다.

지우는 조건은 **사용자가 지도를 움직인 것**이지 주소가 갱신된 것이 아니다. 8번의
최초 조회는 사용자가 움직인 것이 아니므로 상호명을 건드리지 않는다. 직접 입력
경로(`?name`만 있고 주소가 없음)가 정확히 이 경우다 — 이름은 남기고 주소만 채운다.

### 6. 생성 시점의 `idle`을 건너뛴다

`naver.maps.Event`의 `idle`은 지도가 만들어질 때도 한 번 발생한다. 그대로 두면
검색으로 들어오자마자 5번 규칙이 발동해 상호명이 지워진다.

마지막으로 보고한 좌표를 ref에 들고 있다가 같으면 콜백을 부르지 않는다. ref의
초기값은 초기 중심이므로 생성 시점의 `idle`이 자연스럽게 걸러진다.

### 7. 디바운스 타이머를 두지 않는다

`idle`은 지도가 **멈춘 뒤** 발생한다. 드래그하는 동안 계속 오는 이벤트가 아니라
이미 그 자체로 디바운스다. 타이머를 얹으면 반응만 늦어진다.

대신 `AbortController`로 이전 요청을 취소한다. 빠르게 여러 번 끌었을 때 늦게 도착한
옛 응답이 최신 주소를 덮어쓰는 것을 막는다.

### 8. 검색으로 들어왔으면 최초 조회를 하지 않는다

`?address`에 이미 지번주소가 실려 온다. 굳이 부르면 호출을 낭비하고, 검색 결과가 준
주소를 좌표에서 되짚은 주소로 덮어써 미묘하게 다른 문자열이 나올 수 있다.

판단 기준은 **`?address`가 비어 있지 않은지** 하나다. 비어 있으면 마운트 직후 한 번
조회한다. 이 조회는 `idle` 이벤트가 아니라 별도 effect에서 명시적으로 부른다 —
6번의 ref 가드가 생성 시점 `idle`을 걸러 내기 때문에 그쪽에 기댈 수 없다.

| 진입 경로 | 최초 조회 | 초기 주소 |
| --- | --- | --- |
| 검색에서 선택 (`?address` 있음) | 안 함 | `?address` |
| 직접 입력 (`?name`만) | 함 | 조회 결과 |
| 주소창으로 바로 진입 | 함 | 조회 결과 |

### 9. 주소 조립 규칙

```
행정구역 = [area1, area2, area3, area4] 중 비어 있지 않은 것을 " "로 연결
번지     = (land.type === "2" ? "산 " : "") + number1
           + (number2가 있고 "0"이 아니면 "-" + number2)
지번주소 = 행정구역 + " " + 번지
```

`서울특별시 성동구 성수동2가 315-7`

`land`가 없거나 `number1`이 비면 행정구역까지만 조립한다. 행정구역까지 비면 `null`을
돌려 화면이 "주소를 찾을 수 없어요"를 보이게 한다. 빈 문자열을 주소인 척 내려보내면
카드가 아무 글자 없이 비어 조용한 실패가 된다.

`land.type === "2"`는 임야다. 지번 표기가 `산 12-3`이므로 접두사를 붙인다.

### 10. 응답을 하루 캐시한다

`next: { revalidate: 86400 }`. 좌표와 주소의 대응은 사실상 바뀌지 않는다.

다만 효과를 과장하지 않는다. 드래그는 매번 다른 좌표를 만들어 적중률이 높지 않다.
실질적 이득은 새로고침·재방문 같은 반복 요청 방어다.

## 아키텍처

```
/register/place  (서버 컴포넌트)
  └─ PlaceLocationPicker  (클라이언트)      src/components/places/
       ├─ state {center, name, address, status}
       ├─ NaverMap onCenterChange={…}       src/components/ui/NaverMap.tsx
       │    └─ Event.addListener(map, "idle") → getCenter()
       ├─ fetch GET /api/geocode/reverse?lat=&lng=
       └─ Card  (주소 자리: Skeleton | 주소 | 실패 문구)

/api/geocode/reverse  (Route Handler)       src/app/api/geocode/
  ├─ requireUser()                          src/lib/auth/session.ts
  ├─ parseLatLng(lat, lng)                  src/lib/local-search/parse.ts  (재사용)
  └─ reverseGeocode(lat, lng)               src/lib/reverse-geocode/service.ts
       ├─ naverGeocodeCredentials()         src/lib/reverse-geocode/env.ts
       ├─ formatJibunAddress(result)        src/lib/reverse-geocode/format.ts
       └─ ReverseGeocodeResult              src/lib/reverse-geocode/dto.ts
```

| 파일 | 상태 | 역할 |
| --- | --- | --- |
| `src/lib/reverse-geocode/env.ts` | 신규 | 키 두 개. 없으면 던진다 |
| `src/lib/reverse-geocode/dto.ts` | 신규 | `ReverseGeocodeResult` |
| `src/lib/reverse-geocode/format.ts` | 신규 | 응답 → 지번주소 문자열 (순수 함수) |
| `src/lib/reverse-geocode/service.ts` | 신규 | 호출·캐시·에러 |
| `src/app/api/geocode/reverse/route.ts` | 신규 | GET, `withRoute` + `requireUser` |
| `src/components/places/PlaceLocationPicker.tsx` | 신규 | 지도 + 카드 소유 |
| `src/components/ui/NaverMap.tsx` | 수정 | `onCenterChange` prop |
| `src/app/register/place/page.tsx` | 수정 | Picker로 교체 |
| `.env.example` | 수정 | 키 두 개 |

`format.ts`에 `server-only`를 붙이지 않는다. 키를 모르는 계층이고 순수 함수라,
테스트 러너가 생기면 가장 먼저 테스트를 붙일 자리다. `local-search/parse.ts`와
같은 이유다.

`PlaceLocationPicker`는 `src/components/ui/`가 아니라 `src/components/places/`에 둔다.
디자인 시스템 프리미티브가 아니라 이 화면 전용 조립품이다.
`src/components/profile/ProfileEditForm.tsx`가 같은 선례이며, 스토리를 두지 않는 것도
그 선례를 따른다.

### DTO

```ts
export interface ReverseGeocodeResult {
  /** 조립한 지번주소. 좌표는 유효하나 주소를 못 찾으면 null. */
  address: string | null;
}
```

`region`/`land` 원본을 내려보내지 않는다. 화면이 쓰는 것은 문자열 한 줄이고,
네이버 응답 구조를 UI가 알게 되면 그건 스키마가 새어 나간 것이다.

### 서비스 시그니처

```ts
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult>
```

`server-only`를 붙인다. `status.code === 3`(결과 없음)은 예외가 아니라
`{ address: null }`이다 — 바다 한가운데를 가리키는 것은 오류가 아니라 사실이다.
그 외 오류는 던지고 `withRoute`가 500으로 바꾼다.

### `NaverMap` prop 추가

```ts
onCenterChange?: (center: { lat: number; lng: number }) => void;
```

선택 prop이라 기존 `Handoff.stories.tsx`의 `NaverMapFallback`은 그대로 컴파일된다.
`useEffect` 정리에서 `naver.maps.Event.removeListener`로 리스너를 뗀다. 지금도
`mapRef.current?.destroy()`를 하고 있으니 같은 자리에 붙는다.

## 에러 처리

| 경우 | 서버 | 화면 |
| --- | --- | --- |
| 키 없음 | `env.ts`가 던짐 → 500 | "주소를 불러오지 못했어요" + 서버 로그에 빠진 변수 이름 |
| 좌표가 범위 밖·파싱 실패 | 400 `invalid_request` | 클라이언트가 보낼 일 없음 (지도 중심은 항상 유효) |
| 미로그인 | 401 `unauthorized` | 페이지 자체가 로그인 필요라 도달하지 않음 |
| `status.code === 3` | 200 `{ address: null }` | "주소를 찾을 수 없어요" |
| 네이버 4xx/5xx, 네트워크 실패 | 500 `internal_error` | "주소를 불러오지 못했어요" |
| 조회 중 | — | 주소 자리에 `Skeleton` |

실패해도 지도는 계속 쓸 수 있고, 다시 움직이면 재시도된다. 별도 재시도 버튼을 두지
않는 이유다 — 지도를 조금 움직이는 것이 이미 재시도다.

네이버 에러 코드는 화면에 노출하지 않고 `console.error`로 서버 로그에만 남긴다.

## 환경변수

```
# 네이버 리버스 지오코딩 API. NCP 콘솔 > Maps 이용 신청 후 발급한다.
# 지역검색 키(NAVER_SEARCH_*)와도, 브라우저 지도 키(NAVER_MAP_CLIENT_ID)와도 다르다.
# 호스트부터 다르다 — 이쪽은 maps.apigw.ntruss.com이다.
# 진짜 비밀값이다. 서버에서만 읽고 브라우저로 내보내지 않는다.
NAVER_GEOCODE_API_KEY_ID=
NAVER_GEOCODE_API_KEY=
```

이름을 `NAVER_MAP_*`으로 하지 않는다. 기존 `NAVER_MAP_CLIENT_ID`와 한 글자 차이로
붙어 헷갈린다. 도메인으로 가르는 `NAVER_SEARCH_*`의 방식을 따라 `NAVER_GEOCODE_*`로
둔다. 나중에 정방향 지오코딩을 붙이면 같은 키 쌍을 그대로 쓴다.

키가 없으면 주소 자리가 계속 "주소를 불러오지 못했어요"에 머물고 서버 로그에 빠진
변수 이름이 찍힌다. 지도와 검색은 각자의 키로 정상 동작한다.

## 검증

테스트 러너가 없다. `npx tsc --noEmit`, `npm run lint`, 브라우저로 갈음한다.

1. 타입·린트 통과
2. `formatJibunAddress`를 임시 스크립트로 확인
   - 일반 번지 → `서울특별시 성동구 성수동2가 315-7`
   - 부번 없음(`number2: ""` 또는 `"0"`) → `… 315`
   - 임야(`type: "2"`) → `… 산 12-3`
   - `land` 없음 → 행정구역까지만
   - `region`까지 빈 응답 → `null`
3. 키 없이 지도를 움직임 → "주소를 불러오지 못했어요", 서버 로그에
   `환경변수 NAVER_GEOCODE_API_KEY_ID가 없습니다`
4. 키를 넣고 `/register/place`에 검색 없이 진입 → 서울시청 주소가 자동으로 채워진다
5. 지도를 끌어 다른 동네로 이동 → 주소가 그 위치로 바뀌고 상호명이
   "장소를 선택해 주세요"로 되돌아간다
6. 검색으로 "예빈당 성수본점"을 고르고 진입 → 상호명과 `?address`가 그대로 남는다
   (마운트 직후 조회가 일어나지 않는다). 네트워크 탭에 `/api/geocode/reverse` 요청이
   없어야 한다
7. 직접 입력 경로(`/register/place?name=오월식당`, 주소·좌표 없음) → 상호명은 남고
   서울시청 주소가 채워진다. 최초 조회가 상호명을 지우지 않는다
8. 빠르게 여러 번 드래그 → 마지막 위치의 주소만 남는다 (늦게 온 응답이 덮어쓰지 않음)
9. 로그아웃 상태로 `/api/geocode/reverse?lat=37.5&lng=127` 직접 호출 → 401
10. 좌표를 범위 밖으로 (`?lat=0&lng=0`) → 400
11. Storybook의 Handoff 스토리가 여전히 뜬다

4~8은 유효한 키가 있어야 확인된다. 키 발급 전에는 1·2·3과 9·10·11까지다.

## 후속

- 바뀐 좌표·주소를 `/register` 등록 폼까지 전달하고 DB에 저장.
- 맛집 상세 미니맵을 저장된 좌표로 그리기.
- 정방향 지오코딩(주소 → 좌표). 같은 키 쌍을 쓴다.
