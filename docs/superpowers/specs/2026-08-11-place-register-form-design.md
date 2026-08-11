# 맛집 등록 폼 배선 (장소 전달 + 폼 + 지도 필수)

작성일: 2026-08-11

## 배경

`/register`(맛집 등록)는 아직 화면만 그려 놓은 목업이다.

- `<input>`에 `name` 속성이 하나도 없다
- `<form>`에 `action`도 `onSubmit`도 없다
- 저장 버튼은 `disabled`가 하드코딩되어 있고, 에러 배너는 조건 없이 항상 보인다
- `/api/places` POST와 연결이 전혀 없다

파일 주석도 "검증을 실제로 배선하는 것은 다음 단계다"라고 적어 두고 있다. 그
다음 단계가 이 문서다.

앞선 작업으로 서버 쪽은 준비가 끝났다. `POST /api/places`는 `readCreatePlaceInput`이
지도 정보를 필수로 요구하고, 없으면 400을 준다. 그런데 **화면에서 지도 정보를
넣을 수단이 없어 등록이 아예 불가능한 상태다.** 이 문서가 그 구멍을 메운다.

전체 A~F 중 **D와 E**다.

| | 작업 | 상태 |
| --- | --- | --- |
| A | BFF에 지도 정보 | 완료 |
| B | 상세 미니지도 | 완료 |
| C | 리버스 지오코딩 | 완료 |
| D | 고른 장소를 `/register`로 전달 | ✅ 이 문서 |
| E | 등록 폼 배선 + 지도 필수 | ✅ 이 문서 |
| F | 맛집 수정 화면 | 후속 |

## 범위

**한다**

- `/register/place`의 "이 위치로 등록하기"가 고른 장소를 `/register`로 넘긴다
- `/register`가 지도 정보 없이 들어오면 `/register/place`로 리다이렉트한다
- 등록 폼을 실제로 배선한다 — 사진·제목·내용 입력, 검증, `POST /api/places`
- `Dropzone`에 실제 파일 입력을 붙인다
- 저장에 성공하면 만들어진 글의 상세로 이동한다

**하지 않는다**

- 맛집 수정 화면. F다.
- 임시저장. 시안에 버튼이 있지만 저장할 곳이 없다. 지금 배선하면 눌리는 척만 하는 버튼이 된다.
- 사진 순서 바꾸기·대표 사진 지정. 시안에 없다.
- 드래그 앤 드롭 업로드. `Dropzone`의 `dragover` 상태는 시안에 있지만, 파일 선택이 먼저다.

## 결정과 근거

### 1. 장소를 먼저 고른다

```
[등록 버튼/FAB] → /register → (지도 정보 없음) → /register/place
                                                      ↓ "이 위치로 등록하기"
                                 /register?name=&address=&lat=&lng=
                                                      ↓ 사진·제목·내용 → 저장
                                                 /restaurants/{id}
```

대안은 폼 안에서 `BottomSheet`로 고르는 것이었다. 화면 이탈이 없어 초안이 보존되는
장점이 분명하지만, 검색·결과·지도를 시트 안에 다시 구성해야 하고 이미 있는
`/register/place` 라우트와 역할이 겹친다. design.pen도 `04 Place Register - Location`,
`04a Place Search - Results`를 전체 화면으로 그려 뒀다.

**대가를 분명히 적어 둔다.** 폼을 채우다 장소를 바꾸러 가면 고른 사진이 사라진다.
`File` 객체는 URL로 못 나르고 내비게이션을 넘어 살아남지 못한다. 제목·내용은
쿼리로 실어 나를 수 있지만 사진만 살아남지 못하면 반쪽이라, 텍스트도 나르지 않는다.
장소를 먼저 고르는 순서가 이 상황을 드물게 만든다.

### 2. 지도 정보가 없으면 리다이렉트한다

`/register`는 `searchParams`에 유효한 장소가 없으면 `redirect("/register/place")`한다.

폼을 보여 주고 저장만 막는 방법도 있다. 그러면 사용자가 사진과 제목을 먼저 채운 뒤
장소를 고르러 가고, 1번의 대가를 정면으로 맞는다. 리다이렉트가 그 경로를 아예 막는다.

헤더의 "등록" 버튼과 모바일 FAB는 그대로 `/register`를 가리킨다. 진입점을 고치지 않아도
규칙이 한 곳에서 강제된다.

판정 기준은 `readLocation`과 같다 — 이름·주소가 비어 있지 않고 좌표가 한국 범위 안일 것.
`parseLatLng`를 그대로 쓴다.

### 3. 주소는 자유 입력 필드가 아니다

시안에는 주소 `TextField`가 있지만, 손으로 고칠 수 있게 두면 주소와 좌표가 어긋난다.
사용자가 "서울 구로구"라고 고쳐도 지도는 성수동을 가리키고, 저장되면 상세 화면이
거짓말을 한다.

고른 장소는 `Card`로 **읽기 전용** 표시하고, 바꾸려면 "장소 다시 선택"으로
`/register/place`에 현재 값을 들고 돌아간다. 그쪽이 이미 검색·지도·리버스
지오코딩을 갖춘 화면이다.

### 4. 제출은 클라이언트 `fetch`로 한다

`src/components/profile/ProfileEditForm.tsx`가 이미 그 패턴이다 — `useState`로 폼 상태,
`FormData` 조립, `fetch`, `router.push` + `router.refresh`.

서버 액션도 CLAUDE.md가 허용하지만, `POST /api/places`와 `readCreatePlaceInput`이
이미 있고 검증까지 끝나 있다. 서버 액션으로 가면 같은 검증을 부르는 두 번째 입구가
생긴다. 하나로 둔다.

`router.refresh()`를 함께 부르는 이유: 홈과 마이페이지 목록이 서버 컴포넌트라
캐시를 비우지 않으면 방금 쓴 글이 목록에 없다.

### 5. `Dropzone`에 실제 파일 입력을 붙인다

지금은 `onSelect?: () => void`만 있는 표현용 껍데기다. 파일을 받을 통로가 없다.

```ts
accept?: string;
multiple?: boolean;
onFilesSelected?: (files: File[]) => void;
```

`onSelect`는 남긴다. 파일 없이 눌림만 필요한 자리가 있을 수 있고, 지우면 기존
스토리가 깨진다.

`<input type="file">`은 시각적으로 숨기고 박스 전체가 그것을 여는 라벨이 된다.
`opacity-0`으로 덮지 않고 `sr-only` + `label`을 쓴다 — 투명 입력을 겹치면 키보드
포커스 링이 엉뚱한 곳에 그려진다.

### 6. 사진 목록은 `FileItem`으로 보여 준다

이미 있는 컴포넌트다. 이름과 상태를 한 줄로 보여 주고 `onRemove`를 받는다.
썸네일 격자를 새로 만들지 않는다 — 시안에 없고, `FileItem`이 그 자리에 있다.

미리보기 `URL.createObjectURL`도 만들지 않는다. 만들면 `revokeObjectURL`로 되돌릴
책임이 생기는데, 파일 이름만으로 충분한 화면에서 그 복잡도를 살 이유가 없다.

### 7. 검증은 양쪽에서, 판단은 서버가

클라이언트는 `dto.ts`의 상수로 미리 거른다 — 저장 버튼 비활성, 배너 문구.
그래야 5MB 파일을 올렸다 400을 받는 왕복이 없다.

최종 판단은 서버다. 클라이언트 검증은 우회할 수 있고, `readCreatePlaceInput`이
이미 같은 규칙을 갖고 있다. 서버가 400을 주면 그 `error.message`를 배너에 그대로 띄운다.

## 아키텍처

```
/register  (서버 컴포넌트)
  ├─ searchParams에서 name/address/lat/lng
  ├─ parseLatLng + 이름·주소 확인 → 없으면 redirect("/register/place")
  └─ PlaceRegisterForm location={…}   (클라이언트)
       ├─ useState: files[], title, content, error, saving
       ├─ Dropzone onFilesSelected → files 누적
       ├─ FileItem × files (onRemove)
       ├─ Card: 고른 장소 + "장소 다시 선택" → /register/place?name=…
       └─ submit → FormData → POST /api/places
            성공 → router.push(`/restaurants/${id}`) + router.refresh()
            실패 → 배너에 error.message

/register/place  (서버 컴포넌트)
  └─ "이 위치로 등록하기" → /register?name=&address=&lat=&lng=
```

| 파일 | 상태 | 역할 |
| --- | --- | --- |
| `src/components/ui/FileUploader.tsx` | 수정 | `Dropzone`에 파일 입력 |
| `src/stories/ui/Form.stories.tsx` | 수정 | Dropzone 스토리 갱신 |
| `src/components/places/PlaceRegisterForm.tsx` | 신규 | 등록 폼 (클라이언트) |
| `src/app/register/page.tsx` | 수정 | 목업 → 리다이렉트 + 폼 배선 |
| `src/app/register/place/page.tsx` | 수정 | 장소를 쿼리로 넘김 |
| `src/lib/places/location.ts` | 신규 | 쿼리 ↔ `PlaceLocation` 변환 (아래) |

### 쿼리 ↔ 장소 변환을 한 곳에 둔다

`name`/`address`/`lat`/`lng`를 쿼리로 읽고 쓰는 곳이 세 군데가 된다 —
`/register`, `/register/place`, 그리고 폼의 "장소 다시 선택" 링크. 각자 적으면
파라미터 이름 하나가 어긋나는 날이 온다.

```ts
// src/lib/places/location.ts
export function readLocationFromQuery(
  params: Record<string, string | string[] | undefined>,
): PlaceLocation | null;

export function locationToQuery(location: PlaceLocation): string;
```

`server-only`를 붙이지 않는다. 폼(클라이언트)이 "장소 다시 선택" 링크를 만들 때
`locationToQuery`를 쓴다.

### 폼 필드 이름

`readCreatePlaceInput`이 기대하는 이름 그대로다.

```
title    글 제목        (맛집 이름)
content  소개/후기
images   파일 (여러 개)
name     장소명
address  지번주소
lat, lng 좌표 (문자열)
```

`title`과 `name`은 다르다. `title`은 글 제목("성수동 인생 파스타"),
`name`은 검색으로 고른 장소명("예빈당 성수본점")이다. 폼에서 사용자가 쓰는 것은
`title`이고, `name`은 고른 장소에서 그대로 실린다.

## 에러 처리

| 경우 | 처리 |
| --- | --- |
| 지도 정보 없이 `/register` 진입 | `/register/place`로 리다이렉트 |
| 사진 0장 | 저장 버튼 비활성 + Dropzone `error` 상태 |
| 사진 6장째 선택 | 5장까지만 담고 배너에 "사진은 5장까지" |
| 5MB 초과·허용하지 않는 형식 | 그 파일만 버리고 배너에 이유 |
| 제목 없음 / 내용 10자 미만 | 해당 필드 `error` + 저장 버튼 비활성 |
| 서버 400 | 배너에 `error.message` 그대로 |
| 서버 401 | 배너에 로그인 안내 (`/register`는 미들웨어가 이미 막지만 세션 만료가 있다) |
| 네트워크 실패 | 배너에 "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." |

저장 중에는 버튼을 비활성하고 문구를 바꾼다. 두 번 눌러 글이 두 개 생기는 것을 막는다.

## 검증

`npx tsc --noEmit`, `npm run lint`, Storybook, 브라우저, Supabase MCP.

1. 타입·린트 통과
2. `/register`로 바로 진입 → `/register/place`로 리다이렉트된다
3. 검색 → "예빈당 성수본점" 선택 → "이 위치로 등록하기" → `/register`에 장소가 실려 온다
4. 사진 없이 저장 시도 → 버튼이 비활성이다
5. 사진 1장 + 제목 + 내용 10자 이상 → 저장 → `/restaurants/{id}`로 이동하고 그 화면에
   사진·제목·내용·지도·마커·주소가 모두 맞게 보인다
6. Supabase MCP로 그 행을 조회 → `name`/`address`/`lat`/`lng`가 채워져 있다
7. 홈(`/`)과 마이페이지(`/my`)에 새 글이 보이고 카드 meta에 주소가 있다
8. 사진 6장 선택 → 5장만 담기고 배너가 뜬다
9. 5MB 넘는 파일 → 거부되고 배너가 뜬다
10. 폼에서 "장소 다시 선택" → `/register/place`에 현재 장소가 실려 열린다
11. Storybook의 Dropzone 스토리가 여전히 뜬다

## 후속

- F: 맛집 수정 화면. 이 문서의 `PlaceRegisterForm`을 수정 모드까지 받도록 넓히거나,
  `keepImagePaths`를 다루는 별도 폼으로 만든다. `UpdatePlaceInput`은 이미 준비되어 있다.
- 임시저장. 저장할 곳(로컬 초안 또는 서버 draft)을 정하는 것이 먼저다.
- 사진 순서·대표 사진 지정.
