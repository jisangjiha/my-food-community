# 맛집 수정 화면 (F)

작성일: 2026-08-11

## 배경

`PATCH /api/places/{id}`와 `readUpdatePlaceInput`은 완성되어 있다. `UpdatePlaceInput`은
지도 정보까지 필수로 받고, `updatePlace`는 소유자가 아니면 403을 준다. 그런데
**그 라우트를 부르는 화면이 없다.**

상세 화면도 절반만 준비되어 있다. `getPlace(id, viewer?.id)`가 `isMine`을 계산해
내려보내는데 화면이 그 값을 쓰지 않는다. 수정 버튼이 놓일 자리가 비어 있는 셈이다.

A~F 중 마지막 **F**다.

## 범위

**한다**

- `/restaurants/{id}/edit` 수정 화면
- 상세 화면에 "수정" 버튼 (`isMine`일 때만)
- 등록 폼을 수정까지 겸하도록 넓힌다 (`PlaceForm`)
- 기존 사진 유지·삭제 + 새 사진 추가
- 수정 화면에서도 장소를 바꿀 수 있게 한다 (`returnTo`)
- 남의 글 수정 화면 접근 차단

**하지 않는다**

- 마이페이지 카드의 수정 버튼. `IconButton`은 `<button>`이라 링크형 아이콘 버튼을
  새로 만들어야 한다. 카드가 이미 상세로 가는 링크라 수정은 한 번 더 누르면 닿는다.
- 상세 화면의 삭제 버튼. 삭제는 마이페이지에 이미 있다.
- 사진 순서 바꾸기.

## 결정과 근거

### 1. 폼을 하나로 합친다

`PlaceRegisterForm` → `PlaceForm`. `place?: PlaceDto`가 있으면 수정, 없으면 등록이다.

| | 등록 | 수정 |
| --- | --- | --- |
| 초기값 | 빈 값 | 기존 제목·내용·장소명 |
| 사진 | 새 파일만 | 기존 사진(`keepImagePaths`) + 새 파일 |
| 요청 | `POST /api/places` | `PATCH /api/places/{id}` |

나머지는 같다 — 필드, 검증 규칙, 장소 카드, 에러 배너, 저장 버튼. 별도 컴포넌트로
나누면 그 전부가 두 벌이 되고, 한쪽만 고치는 날이 온다.

`mode` 같은 문자열 플래그 대신 `place`의 유무로 가른다. 플래그를 두면 `mode="edit"`인데
`place`가 없는 상태가 타입상 가능해진다.

### 2. 사진은 "최종 상태"로 다룬다

`UpdatePlaceInput`의 규약을 그대로 따른다 — 남길 기존 사진의 경로(`keepImagePaths`)와
새로 올릴 파일(`images`)을 보내고, 목록에 없는 사진은 서버가 지운다.

화면에서는 둘을 한 목록으로 보여 준다. 기존 사진은 `path`, 새 사진은 파일 이름이
키다. 지우기는 각각의 배열에서 빼는 것이고, 개수 검사는 **남긴 것 + 새로 올린 것**의
합으로 한다. 서버의 `assertImageCount`와 같은 식이다.

기존 사진을 `File`로 되돌리지 않는다. 그러려면 URL에서 내려받아야 하는데, 서버는
경로만 있으면 되므로 통째로 낭비다.

### 3. `returnTo`로 돌아올 곳을 넘긴다

`/register/place`의 "이 위치로 등록하기"는 지금 항상 `/register`로 간다. 수정
화면에서 장소를 바꾸러 갔다가 그리로 가면 새 글 쓰기가 되어 버린다.

`returnTo` 쿼리를 받아 그곳으로 돌아간다. 없으면 `/register`다.

**오픈 리다이렉트를 막는다.** `returnTo`는 URL에 실려 오는 값이라 사용자가 무엇이든
넣을 수 있다. `/`로 시작하고 `//`로 시작하지 않는 내부 경로만 받아들이고, 아니면
기본값으로 물러선다. `//evil.com`은 브라우저가 프로토콜 상대 URL로 읽어 외부로 나간다.

버튼 문구도 함께 받는다. 수정 흐름에서 "이 위치로 등록하기"는 거짓말이다.

### 4. 남의 글은 수정 화면 자체가 열리지 않는다

`/restaurants/**`는 미들웨어의 `PROTECTED_PREFIXES`(`/my`, `/register`)에 없다.
그래서 수정 페이지가 직접 확인한다 — 서버에서 글을 읽어 `isMine`이 아니면 `notFound()`.

`updatePlace`도 403을 주지만 그건 저장 버튼을 누른 뒤다. 화면이 열리고 남의 글 내용이
폼에 채워지는 것 자체가 새는 것이다.

`notFound()`를 쓰고 403 화면을 따로 만들지 않는다. "남의 글이라 못 고친다"는 응답은
그 글이 존재한다는 사실을 알려 준다. 상세는 어차피 공개라 큰 비밀은 아니지만, 없는
글과 같이 다루는 편이 화면 하나를 덜 만든다.

### 5. 수정에서도 지도 정보는 필수다

등록과 같다. 수정 화면도 주소·좌표가 없으면 들어갈 수 없어야 하는데, 여기서는
**기존 글의 값이 기본값**이다.

```
쿼리에 장소가 있으면 → 그것 (장소를 바꾸고 돌아온 경우)
없으면              → 글에 저장된 location
글에도 없으면        → /register/place?returnTo=…로 보낸다 (레거시 행)
```

세 번째가 실제로 있다. 지도 정보가 필수가 되기 전에 들어온 행은 `location`이 `null`이다.
그런 글을 고치려면 장소를 먼저 골라야 한다 — 그게 "지도 정보는 필수"의 뜻이다.

## 아키텍처

```
/restaurants/{id}            (서버)
  └─ place.isMine → ButtonLink "수정" → /restaurants/{id}/edit

/restaurants/{id}/edit       (서버)
  ├─ getPlace(id, viewer.id) → isMine 아니면 notFound()
  ├─ 쿼리의 장소 ?? place.location ?? redirect(/register/place?returnTo=…)
  └─ PlaceForm place={place} location={…}   (클라이언트)
       └─ PATCH /api/places/{id} → router.push(`/restaurants/${id}`)

/register/place              (서버)
  └─ PlaceLocationPicker returnTo=… confirmLabel=…
       └─ ButtonLink href={`${returnTo}?${query}`}
```

| 파일 | 상태 | 역할 |
| --- | --- | --- |
| `src/lib/places/location.ts` | 수정 | `readReturnTo()` — 내부 경로만 통과 |
| `src/components/places/PlaceForm.tsx` | 이름 변경 + 수정 | `PlaceRegisterForm`에서. `place` prop |
| `src/components/places/PlaceLocationPicker.tsx` | 수정 | `returnTo`, `confirmLabel` |
| `src/app/register/place/page.tsx` | 수정 | `returnTo` 읽어 picker에 전달 |
| `src/app/register/page.tsx` | 수정 | `PlaceForm`으로 이름만 교체 |
| `src/app/restaurants/[id]/edit/page.tsx` | 신규 | 수정 화면 |
| `src/app/restaurants/[id]/page.tsx` | 수정 | "수정" 버튼 |

### `readReturnTo`

```ts
/**
 * 돌아갈 내부 경로. 아니면 기본값.
 *
 * `//evil.com`은 프로토콜 상대 URL이라 브라우저가 외부로 읽는다. `/`로 시작하는
 * 것만으로는 부족하다.
 */
export function readReturnTo(
  value: string | string[] | undefined,
  fallback: string,
): string;
```

## 에러 처리

| 경우 | 처리 |
| --- | --- |
| 남의 글 `/edit` | `notFound()` |
| 없는 글·지운 글 `/edit` | `notFound()` (기존 `loadPlace`와 같다) |
| 비로그인 `/edit` | `isMine`이 false이므로 `notFound()` |
| 장소 정보가 전혀 없는 글 | `/register/place?returnTo=/restaurants/{id}/edit`로 보낸다 |
| 사진 0장(남긴 것 + 새 것) | 저장 버튼 비활성 |
| 서버 400/403 | 배너에 `error.message` |
| `returnTo`가 외부 URL | 무시하고 기본값 |

## 검증

1. 타입·린트 통과
2. 내 글 상세에 "수정" 버튼이 보이고, 남의 글·비로그인 상세에는 없다
3. 수정 화면에 기존 제목·내용·장소명·사진·주소가 채워져 있다
4. 제목과 내용을 바꿔 저장 → 상세에 반영되고 DB도 바뀐다
5. 기존 사진을 지우고 새 사진을 올려 저장 → 상세의 사진이 바뀐다
6. 사진을 전부 지우면 저장 버튼이 비활성이다
7. "장소 다시 선택" → `/register/place`에 현재 장소가 실리고 버튼 문구가
   "이 위치로 변경하기"다. 고르면 **수정 화면으로** 돌아온다
8. 장소를 바꿔 저장 → 상세 지도와 주소가 바뀐다
9. 남의 글 `/restaurants/{남의 id}/edit` → 404
10. `/register/place?returnTo=//evil.com` → 버튼이 `/register`로 간다
11. 지도 정보가 없는 레거시 글의 `/edit` → `/register/place`로 보내진다
12. 등록 흐름이 그대로 동작한다 (회귀)

## 후속

- 상세 화면의 삭제 버튼.
- 마이페이지 카드의 수정 버튼 (링크형 아이콘 버튼이 먼저 필요하다).
- 사진 순서·대표 사진.
