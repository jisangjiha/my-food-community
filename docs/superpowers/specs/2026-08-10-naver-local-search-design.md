# 네이버 지역검색 API 연동

작성일: 2026-08-10

## 배경

`/register/place/search`는 지금 목 데이터를 검색한다. `src/lib/places/search.ts`에
시안의 5건이 박혀 있고, 파일 주석은 이미 자기 운명을 적어 뒀다 — "API가 붙으면
이 파일은 사라진다".

그 자리에 네이버 지역검색 API를 넣는다. 그리고 고른 결과가 이전 화면
(`/register/place`)으로 실제로 돌아오게 만든다. 지금은 `?place=<목 id>`를 들고
가지만, 목이 사라지면 그 손잡이도 같이 사라진다.

## 범위

**한다**

- `/register/place/search`가 네이버 지역검색 API를 호출
- 결과를 고르면 `/register/place`로 돌아가 검색어·지번주소·좌표를 반영
- 결과가 없으면 직접 입력 폼, 제출하면 이름만 들고 `/register/place`로 복귀
- `NaverMap`에 `center` prop 추가 (선택한 좌표를 지도 중심에)
- API 키를 `.env.example`로 분리

**하지 않는다**

- 역지오코딩. 사용자가 지도를 움직여 위치를 고르는 흐름은 다음 작업이다.
- 페이지네이션. `display` 상한이 5라 한 번에 5건이 전부고, 시안도 5줄이다.
- 맛집 등록 폼(`/register`)으로 선택을 전달하는 일. 그 폼은 아직 배선 전이다.
- 맛집 상세의 미니맵.

## 외부 API

```
GET https://naverapihub.apigw.ntruss.com/search/v1/local
    ?query={UTF-8 인코딩한 검색어}&display=5

헤더:
  X-NCP-APIGW-API-KEY-ID: {Client ID}
  X-NCP-APIGW-API-KEY:    {Client Secret}
```

- `display`는 **1~5, 기본값 1**이다. 명시하지 않으면 결과가 한 건만 온다.
- `sort`는 기본값(정확도순)을 쓴다. 장소를 고르는 화면에는 리뷰순보다 맞다.
- 하루 25,000회 한도.

응답 항목에서 쓰는 필드는 `title`, `address`(지번), `roadAddress`(도로명),
`mapx`(경도), `mapy`(위도)다. `telephone`은 문서상 항상 빈 문자열이라 무시한다.

에러는 `SE01`~`SE06`, `SE99` 코드로 온다. 우리는 코드별로 분기하지 않는다 —
사용자가 할 수 있는 일이 "다시 시도" 하나뿐이라 갈라 봐야 문구만 늘어난다.

## 결정과 근거

### 1. 선택 결과는 URL 쿼리로 되돌린다

`/register/place?name=...&address=...&lat=...&lng=...`

이 코드베이스가 이미 그렇게 돌아간다. 검색 페이지 주석이 "상태를 클라이언트에
담지 않으므로 결과 화면을 그대로 공유하거나 새로고침해도 같은 것이 나오고,
자바스크립트 없이도 검색이 돈다"고 적어 뒀고, 현재 `?place=`도 같은 방식이다.

쿠키에 담으면 URL은 깔끔해지지만 뒤로가기·새로고침·공유가 전부 어긋나고 수명
관리가 붙는다. 클라이언트 상태로 옮기면 자바스크립트 없이 안 돌아간다. 둘 다
얻는 것 없이 잃는 쪽이다.

### 2. Route Handler를 만들지 않는다

`CLAUDE.md`: "읽기 전용 데이터는 서버 컴포넌트에서 BFF 계층 함수를 직접
호출해도 된다(자기 자신에게 HTTP 요청 금지)."

검색 페이지는 서버 컴포넌트고 `?q=`로 검색어를 받는다. 클라이언트가 검색을
부를 일이 없으므로 `/api/...` 라우트는 쓸 데가 없다. 필요해지는 순간
`src/lib/local-search/service.ts`를 그대로 감싸면 된다.

### 3. 좌표는 방어적으로 파싱한다

문서는 `mapx`/`mapy`가 WGS84라고만 하고 자릿수 예시를 `{경도}`, `{위도}`
플레이스홀더로 남겨 뒀다. 네이버 검색 API는 역사적으로 도(degree)×10⁷ 정수
문자열(`"1270276240"`)을 돌려줬다. 둘 중 무엇이 와도 맞게 처리한다.

```
숫자로 파싱 → 절댓값이 1000을 넘으면 10⁷로 나눈다
→ 한국 범위(위도 33~39, 경도 124~132) 밖이면 null
```

범위 검사가 핵심이다. 나누기를 잘못하면 지도가 아프리카 앞바다를 가리키는데,
그건 조용한 실패라 아무도 눈치채지 못한다. 범위를 벗어나면 좌표를 버리고
기본 중심을 쓴다 — 틀린 위치를 자신 있게 보여 주는 것보다 낫다.

### 4. `title`의 HTML을 벗긴다

검색어가 `<b>오월</b>식당`처럼 태그로 감싸여 온다. 태그와 HTML 엔티티
(`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`)를 제거한다. React가 문자열을
이스케이프해 주므로 XSS 문제는 아니지만, 그대로 두면 화면에 `<b>`가 글자로
보인다.

### 5. 기본값은 한 규칙으로 통일한다

| 값 | 없을 때 |
| --- | --- |
| `name` | 빈 문자열 — 검색창이 비고, 카드는 "장소를 선택해 주세요" |
| `address` | `PLACE_PENDING_ADDRESS`("등록 대기중") — 이미 앱 전체가 쓰는 상수 |
| `lat`/`lng` | `SEOUL_CITY_HALL` |

직접 입력 경로(`?name=`만 있음)가 이 규칙에 그대로 얹힌다. 별도 분기가 없다.

`?place=`로 오월식당이 미리 선택돼 보이던 기존 동작은 사라진다. 목이 없어진
마당에 특정 식당이 골라진 척하는 것은 거짓말이다.

### 6. 응답을 1시간 캐시한다

하루 25,000회 한도가 있고, 상호와 좌표는 분 단위로 바뀌지 않는다. Next.js
`fetch`의 `next: { revalidate: 3600 }`을 쓴다. 캐시 키는 URL이므로 검색어별로
갈린다.

## 아키텍처

```
/register/place/search  (서버 컴포넌트)
  └─ searchLocalPlaces(query)          src/lib/local-search/service.ts
       ├─ NAVER_SEARCH_CLIENT_ID/SECRET  src/lib/local-search/env.ts
       └─ LocalSearchResult[]            src/lib/local-search/dto.ts

  결과 있음 → PlaceResultItem href="/register/place?name=…&address=…&lat=…&lng=…"
  결과 없음 → GET 폼 action="/register/place" (name 필드 하나)
  호출 실패 → Empty "검색을 불러오지 못했어요"

/register/place  (서버 컴포넌트)
  ├─ searchParams에서 name/address/lat/lng
  ├─ TextField defaultValue={name}
  ├─ NaverMap center={{lat, lng}}
  └─ Card 주소 = address
```

| 파일 | 상태 | 역할 |
| --- | --- | --- |
| `src/lib/local-search/env.ts` | 신규 | 키 두 개. 없으면 던진다 |
| `src/lib/local-search/dto.ts` | 신규 | `LocalSearchResult` |
| `src/lib/local-search/service.ts` | 신규 | 호출·정제·좌표 변환 |
| `src/lib/places/search.ts` | 삭제 | 목 데이터 |
| `src/app/register/place/search/page.tsx` | 수정 | 3상태 렌더 |
| `src/app/register/place/page.tsx` | 수정 | 쿼리 반영 |
| `src/components/ui/NaverMap.tsx` | 수정 | `center` prop |
| `src/stories/ui/Handoff.stories.tsx` | 수정 | 목 의존 제거 |
| `.env.example` | 수정 | 키 두 개 |

### DTO

```ts
export interface LocalSearchResult {
  /** HTML 태그를 벗긴 상호명. */
  name: string;
  /** 지번 주소. 화면과 되돌림 값 모두 이것을 쓴다. */
  address: string;
  /** 도로명 주소. 지번이 비어 있을 때의 대체재. */
  roadAddress: string;
  /** WGS84. 파싱이나 범위 검사에 실패하면 null. */
  lat: number | null;
  lng: number | null;
}
```

`id`는 두지 않는다. 네이버가 안정적인 식별자를 주지 않고, 이제 화면 간 이동에
필요한 것은 값 자체(`name`/`address`/`lat`/`lng`)이지 손잡이가 아니다. React
key는 인덱스와 이름을 합쳐 만든다.

### 서비스 시그니처

```ts
export async function searchLocalPlaces(
  query: string,
): Promise<LocalSearchResult[]>
```

빈 검색어는 호출 없이 빈 배열. 호출 실패는 예외를 던지고, 페이지가 잡는다.

`server-only`를 붙인다. 클라이언트가 실수로 import 하면 빌드가 깨진다 —
Secret이 번들에 들어가는 것보다 훨씬 나은 실패다.

## 에러 처리

| 경우 | 처리 |
| --- | --- |
| 키 없음 | `env.ts`가 던지고, 아래 줄과 같은 경로로 잡힌다. 사용자는 어차피 손쓸 수 없고, 개발자는 로그에서 빠진 변수 이름을 정확히 본다 |
| 네이버 4xx/5xx, 네트워크 실패 | 서비스가 던지고, 페이지가 잡아 `Empty`로 "검색을 불러오지 못했어요" |
| 좌표 파싱 실패 | 그 항목의 `lat`/`lng`만 `null`. 결과 줄은 그대로 보인다 |
| 결과 0건 | 직접 입력 폼 (기존 UI 재사용) |

원인은 `console.error`로 서버 로그에만 남긴다. 네이버 에러 코드를 화면에
노출하지 않는다.

## 환경변수

```
# 네이버 지역검색 API. NCP 콘솔 > API Hub > Search 이용 신청 후 발급.
# 지도 키(NAVER_MAP_CLIENT_ID)와 별개다.
# 이 둘은 진짜 비밀값이다. 서버에서만 읽고 브라우저로 내보내지 않는다.
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
```

발급에는 NCP 콘솔 로그인이 필요하다. 없으면 `/register/place/search`에서 검색이
"검색을 불러오지 못했어요" 상태로 끝나고, 서버 로그에 빠진 변수 이름이 찍힌다.
지도처럼 "가짜라도 보여 주는" 폴백은 없다 — 지도는 등록 화면의 한 조각이지만
검색 결과는 지어낼 수가 없다.

## 검증

테스트 러너가 없다. `npx tsc --noEmit`, `npm run lint`, 브라우저, Storybook으로
갈음한다.

1. 타입·린트 통과
2. 좌표 변환 함수를 임시 스크립트로 확인 — `"1270276240"` → `127.027624`,
   `"127.027624"` → `127.027624`, `"0"` → `null`, `""` → `null`
3. 키 없이 `/register/place/search?q=오월` → "검색을 불러오지 못했어요"가 뜨고
   서버 로그에 `환경변수 NAVER_SEARCH_CLIENT_ID가 없습니다`가 찍힌다
4. 키를 넣고 `?q=오월` → 결과 5건 이하, 상호에 `<b>`가 보이지 않는다
5. 결과를 고르면 `/register/place`로 돌아가 검색창·주소·지도 중심이 모두 맞는다
6. `?q=` 아무 결과 없는 검색어 → 직접 입력 폼, 제출하면 이름만 채워져 복귀하고
   주소는 "등록 대기중", 지도는 서울시청
7. Storybook의 Handoff 스토리가 여전히 뜬다

4~6은 유효한 키가 있어야 확인된다. 키 발급 전에는 1~3과 7까지다.

## 후속

- 역지오코딩. 지도를 움직여 중심 좌표를 주소로 바꾸고, 직접 입력 경로가 그
  결과를 쓰게 한다. 이번 작업이 `center` prop과 좌표 파싱을 미리 깔아 둔다.
- 선택한 좌표를 `/register` 등록 폼까지 전달하고 DB에 저장.
- 맛집 상세 미니맵을 저장된 좌표로 그리기.
