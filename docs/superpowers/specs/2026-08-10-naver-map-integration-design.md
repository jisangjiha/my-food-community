# 장소 등록 화면 네이버 지도 연동

작성일: 2026-08-10

## 배경

`/register/place`(맛집 등록 → "장소 입력하기")의 지도는 진짜 지도가 아니다.
`src/components/ui/MapCanvas.tsx`가 CSS로 길과 블록을 그린 도식이다. 핸드오프
시점에 지도 API가 없어, 특정 동네의 타일 이미지를 모든 글에 깔아 "이 좌표를
안다"고 거짓말하는 대신 도식을 택한 결과다.

이제 그 자리에 네이버 지도를 넣는다.

## 범위

**한다**

- `/register/place`의 큰 지도(`size="lg"`)를 네이버 지도로 교체
- 지도 기본 중심은 서울시청
- 핀은 화면 정중앙에 고정, 그 아래에서 지도만 움직인다
- 지도 API 키를 `.env.example`로 분리

**하지 않는다**

- 맛집 상세(`/restaurants/[id]`)의 미니맵(`size="sm"`). 게시글마다 실제 좌표가
  없는데 지도를 진짜로 바꾸면 모든 글이 서울시청을 가리키게 된다. 도식으로 둔다.
- 지오코딩·역지오코딩. 선택한 장소의 주소를 좌표로 바꾸거나, 드래그한 좌표를
  주소로 되돌리지 않는다.
- 드래그 결과를 등록 데이터에 반영하는 일. 맛집 등록 폼 자체가 아직 배선 전이라
  받을 곳이 없다.

## 결정과 근거

### 1. 지도 중심은 항상 서울시청

`src/lib/places/search.ts`의 장소 데이터에는 이름과 주소 문자열만 있고 좌표가
없다. 좌표를 얻는 길은 목 데이터에 상수를 박거나 지오코딩 API를 붙이는 것인데,
이번 작업의 목적은 지도 연동 자체를 세우는 것이다. 중심을 한 점에 고정해
연동만 검증한다.

좌표: `37.5666103, 126.9783882` / 줌 `16`.

`?place=`로 어떤 장소가 오든 지도는 같은 곳을 본다. 카드에 적힌 주소와 지도가
어긋난다는 뜻이므로, 후속 작업에서 좌표를 붙일 자리임을 코드 주석에 남긴다.

### 2. 핀은 마커가 아니라 오버레이

`naver.maps.Marker`는 좌표에 붙어 지도와 함께 움직인다. 필요한 동작은 그 반대다
— 핀은 화면 정중앙에 못 박히고 지도가 그 밑에서 흐른다. 그래서 핀은 지도
컨테이너 위에 `absolute`로 얹은 DOM 오버레이로 둔다.

오버레이에는 `pointer-events-none`이 필수다. 없으면 핀이 드래그를 가로채
지도 한가운데가 죽은 영역이 된다.

### 3. API 키는 서버 컴포넌트가 읽어 prop으로 내린다

네이버 지도 웹 키는 비밀값이 아니다. NCP 콘솔에 등록한 도메인에서만 동작하므로
실제 방어선은 "숨기기"가 아니라 "도메인 허용목록"이다. 그래도 `NEXT_PUBLIC_`을
붙이지 않는다. `CLAUDE.md`의 규칙을 지키면서, 키가 브라우저로 나가는 경로를
서버 컴포넌트 한 줄로 좁혀 두기 위해서다.

BFF로 `maps.js`를 프록시하는 안은 버렸다. 네이버는 Referer로 인증하므로 프록시가
오히려 깨지기 쉽고, 스크립트가 로드된 뒤 타일은 어차피 브라우저가 직접 받는다.
감춰지는 것 없이 실패 지점만 는다.

### 4. 키가 없거나 지도가 실패하면 도식으로 되돌린다

Supabase 환경변수는 없으면 `required()`가 던진다. 지도는 그렇게 하지 않는다.
지도는 등록 흐름의 한 조각이고, 키가 없다고 `/register/place` 전체가 500이 되면
나머지 작업까지 막힌다. `MapCanvas`를 지우지 않고 폴백으로 남기는 이유다.

## 아키텍처

```
page.tsx (서버)                     ← NAVER_MAP_CLIENT_ID를 읽는다
  └─ NaverMap (클라이언트)          ← clientId를 prop으로 받는다
       ├─ next/script               ← maps.js 로드
       ├─ 지도 컨테이너 <div>       ← naver.maps.Map이 그린다
       ├─ CenterPin                 ← 중앙 고정, pointer-events-none
       └─ (실패 시) MapCanvas       ← 기존 도식
```

| 파일 | 상태 | 역할 |
| --- | --- | --- |
| `src/lib/maps/env.ts` | 신규 | `NAVER_MAP_CLIENT_ID`를 읽는 유일한 곳 |
| `src/components/ui/NaverMap.tsx` | 신규 | 스크립트 로드 + 지도 생성 + 폴백 |
| `src/components/ui/MapCanvas.tsx` | 수정 | `CenterPin`을 export |
| `src/app/register/place/page.tsx` | 수정 | env를 읽어 `NaverMap`에 전달 |
| `src/stories/ui/Handoff.stories.tsx` | 수정 | `NaverMap` 스토리 추가 |
| `.env.example` | 수정 | `NAVER_MAP_CLIENT_ID` 항목 |
| `package.json` | 수정 | `@types/navermaps` devDependency |

### `src/lib/maps/env.ts`

```ts
export const NAVER_MAP_CLIENT_ID = process.env.NAVER_MAP_CLIENT_ID ?? null;
```

`supabase/env.ts`의 `required()`를 쓰지 않는다. 던지는 대신 `null`을 돌려주고,
받는 쪽이 폴백을 고른다. 왜 다른지를 주석으로 남긴다.

### `src/components/ui/NaverMap.tsx`

```ts
export interface NaverMapProps {
  /** 핀이 가리키는 곳. 대체 텍스트에 들어간다. MapCanvas와 같은 규약. */
  label: string;
  /** NCP Client ID. null이면 도식으로 폴백한다. */
  clientId: string | null;
  className?: string;
}
```

`size` prop은 두지 않는다. 쓰는 곳이 등록 화면 하나뿐이고, 필요해지면 그때
`MapCanvas`처럼 열면 된다.

크기·라운드·테두리는 `MAP_CANVAS_SIZES.lg`를 그대로 쓴다. 시안 값이 두 파일로
갈라지지 않게 한다.

**지도 옵션**

| 옵션 | 값 | 이유 |
| --- | --- | --- |
| `center` | 서울시청 | 위 결정 1 |
| `zoom` | 16 | 건물이 구분되는 축척 |
| `draggable`·`pinchZoom`·`scrollWheel`·`keyboardShortcuts` | true | 지도는 움직여야 한다 |
| `zoomControl` | true (우하단) | 데스크톱에서 휠 말고도 줌할 길 |
| `mapDataControl`·`scaleControl` | false | 등록 화면에 필요 없다 |
| `logoControl` | true | 이용약관상 로고·저작권 표기는 지울 수 없다 |

**스크립트 로드**

`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId={clientId}`

`next/script`를 `strategy="afterInteractive"`로 쓴다. 같은 `src`는 중복 로드하지
않으므로 페이지를 오가도 한 번만 받는다. 초기화는 `onReady`에서 한다 —
`onLoad`와 달리 이미 로드된 뒤 다시 마운트될 때도 불린다.

`AGENTS.md`가 경고하듯 이 저장소의 Next.js는 익숙한 버전이 아니다. 구현 전
`node_modules/next/dist/docs/`에서 `next/script` 문서를 확인한다. `onReady`의
동작이 다르면 `useEffect`에서 직접 주입하는 방식으로 바꾼다.

### `MapCanvas`에서 `CenterPin` 분리

지금 `MapCanvas.tsx:82-95`의 중앙 핀 마크업을 `CenterPin`으로 빼고 두 컴포넌트가
같이 쓴다. `CLAUDE.md`의 "신규 구현·복제 금지"가 그대로 적용되는 자리다.

```ts
export function CenterPin({ size }: { size: MapCanvasSize })
```

별도 파일로 만들지 않는다. `MapCanvas`의 내부 조각이고, 파일을 나누면
`CLAUDE.md`가 신규 UI 컴포넌트마다 요구하는 스토리까지 딸려 온다.

## 에러 처리

세 갈래 모두 `MapCanvas` 도식으로 되돌아간다. 사용자는 지금 화면이 진짜 지도가
아니라는 것만 알면 되고, 원인은 콘솔에 한 줄 남긴다.

| 경우 | 감지 | 처리 |
| --- | --- | --- |
| 키 없음 | `clientId === null` | 서버가 처음부터 도식을 렌더. 클라이언트 코드가 아예 실행되지 않는다 |
| 스크립트 로드 실패 | `next/script`의 `onError` | 도식으로 교체 + `console.error` |
| 네이버 인증 실패 | `window.navermap_authFailure()` | 도식으로 교체 + `console.error` |

세 번째가 특히 중요하다. 도메인 미등록이나 키 오타는 네트워크 에러를 내지
않는다. 이 훅이 없으면 회색 빈 사각형만 남아 원인을 알 수 없다.

훅은 마운트 시 `useEffect`에서 `window`에 등록한다. `afterInteractive`는
하이드레이션 이후에 스크립트를 주입하므로 등록이 먼저 끝난다.

## 환경변수

`.env.example`에 추가한다.

```
# 네이버 지도 JS API. NCP 콘솔 > Maps > Application에서 발급한 Client ID(Key ID).
# 브라우저에 노출되는 값이라 비밀값이 아니다. 실제 방어선은 NCP 콘솔에 등록한
# "Web 서비스 URL" 허용목록이므로, 배포 도메인을 반드시 등록한다.
# NEXT_PUBLIC_을 붙이지 않는 이유: 노출 경로를 서버 컴포넌트 한 곳으로 좁히기
# 위해서다. src/lib/maps/env.ts만 이 값을 읽는다.
NAVER_MAP_CLIENT_ID=
```

키 발급에는 NCP 콘솔 로그인이 필요하다. 발급해 `.env.local`에 넣기 전까지는
폴백 도식이 보인다. 로컬 개발이라면 NCP 콘솔의 Web 서비스 URL에
`http://localhost:3000`(현재 3000이 점유되어 3001로 뜨면 그 주소)도 등록해야
한다.

## 검증

이 저장소에는 테스트 러너가 없다(`package.json`에 `test` 스크립트 없음).
Storybook이 디자인 SSOT이므로 검증은 아래로 갈음한다.

1. `npx tsc --noEmit` — `@types/navermaps`를 넣어 `naver.maps.*`에 `any`를 쓰지
   않는다.
2. `npm run lint`
3. 개발 서버 `/register/place`를 브라우저로 열어 확인
   - 타일이 그려지는가
   - 드래그·줌 후에도 핀이 정확히 중앙에 남는가
   - 핀 위에서 시작한 드래그가 지도를 움직이는가 (`pointer-events-none` 확인)
   - `.env.local`에서 키를 빼면 도식으로 되돌아가는가
4. Storybook에 `NaverMap` 스토리 추가 — 키 없는 폴백 상태를 포함한다

3번의 "타일이 그려지는가"는 유효한 키가 있어야 확인된다. 키가 없는 동안에는
1·2·4와 폴백 경로까지만 검증된다.

## 후속

- 장소 좌표. 목 데이터에 좌표를 넣거나 지오코딩을 붙이면 지도가 선택한 장소를
  실제로 가리킨다.
- 드래그한 좌표를 등록 폼으로 전달. 맛집 등록 폼에 상태가 생기는 시점의 일이다.
- 상세 페이지 미니맵. 게시글에 좌표가 생긴 뒤에 바꾼다.
