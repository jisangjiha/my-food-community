# 맛집 수정 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/restaurants/{id}/edit` 수정 화면을 만들고, 등록 폼을 수정까지 겸하게 한다.

**Architecture:** `PlaceRegisterForm`을 `PlaceForm`으로 넓혀 `place?: PlaceDto`가 있으면 수정 모드로 동작한다. 사진은 `keepImagePaths`(기존) + `images`(새 파일)의 "최종 상태"로 다룬다. 장소를 바꾸러 갈 때는 `returnTo`로 돌아올 곳을 넘기고, 오픈 리다이렉트를 막기 위해 내부 경로만 통과시킨다.

**Tech Stack:** Next.js 16.2.12 (App Router), React 19.2.4, TypeScript 5

설계 문서: `docs/superpowers/specs/2026-08-11-place-edit-design.md`

## Global Constraints

- 테스트 러너가 없다. 검증은 `npx tsc --noEmit`, `npm run lint`, 브라우저, Supabase MCP.
- `src/components/ui/*`를 재사용한다. 신규 UI 프리미티브를 만들지 않는다.
- 변경(mutation)은 기존 Route Handler를 통한다. 서버 액션을 만들지 않는다.
- 폼 필드 이름은 `readUpdatePlaceInput`이 기대하는 그대로: `title`, `content`, `name`, `address`, `lat`, `lng`, `images`, `keepImagePaths`.
- 커밋 메시지는 한국어.
- 작업 브랜치는 `feat/naver-reverse-geocoding`. 이미 체크아웃되어 있다.

## 파일 구조

| 파일 | 상태 | 책임 | Task |
| --- | --- | --- | --- |
| `src/lib/places/location.ts` | 수정 | `readReturnTo` | 1 |
| `src/components/places/PlaceLocationPicker.tsx` | 수정 | `returnTo`·`confirmLabel` | 1 |
| `src/app/register/place/page.tsx` | 수정 | `returnTo` 전달 | 1 |
| `src/components/places/PlaceForm.tsx` | 이름 변경 + 수정 | 수정 모드 | 2 |
| `src/app/register/page.tsx` | 수정 | import 이름 | 2 |
| `src/app/restaurants/[id]/edit/page.tsx` | 신규 | 수정 화면 | 3 |
| `src/app/restaurants/[id]/page.tsx` | 수정 | "수정" 버튼 | 3 |

---

### Task 1: returnTo 배선

**Files:**
- Modify: `src/lib/places/location.ts`
- Modify: `src/components/places/PlaceLocationPicker.tsx`
- Modify: `src/app/register/place/page.tsx`

**Interfaces:**
- Produces:
  - `readReturnTo(value: string | string[] | undefined, fallback: string): string`
  - `PlaceLocationPickerProps.returnTo?: string`, `.confirmLabel?: string`

- [ ] **Step 1: `readReturnTo`를 추가한다**

`src/lib/places/location.ts` 끝에 붙인다:

```ts
/**
 * 돌아갈 내부 경로. 아니면 기본값.
 *
 * `returnTo`는 URL에 실려 오는 값이라 사용자가 무엇이든 넣을 수 있다. 그대로
 * 링크에 쓰면 오픈 리다이렉트다.
 *
 * `/`로 시작하는 것만으로는 부족하다 — `//evil.com`은 프로토콜 상대 URL이라
 * 브라우저가 외부 주소로 읽는다.
 */
export function readReturnTo(
  value: string | string[] | undefined,
  fallback: string,
): string {
  const path = readParam(value);
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}
```

- [ ] **Step 2: picker가 돌아갈 곳과 문구를 받는다**

`PlaceLocationPickerProps`에 두 줄을 더한다:

```ts
  /**
   * "이 위치로 …" 버튼이 갈 곳. 기본은 등록 화면이다.
   *
   * 수정 흐름에서 장소를 바꾸러 오면 여기로 되돌아가야 한다. 페이지가 이미
   * `readReturnTo`로 걸러 넘겨준다 — 이 컴포넌트는 검사하지 않는다.
   */
  returnTo?: string;
  /** 버튼 문구. 수정 흐름에서 "등록하기"는 거짓말이다. */
  confirmLabel?: string;
```

시그니처에 기본값과 함께 추가한다:

```tsx
export function PlaceLocationPicker({
  initialName,
  initialAddress,
  initialCenter,
  clientId,
  returnTo = "/register",
  confirmLabel = "이 위치로 등록하기",
}: PlaceLocationPickerProps) {
```

`ButtonLink`의 `href`와 문구를 바꾼다:

```tsx
      <ButtonLink
        href={`${returnTo}?${locationDraftToQuery({ name, address, ...center })}`}
        aria-disabled={status !== "idle"}
        className={`w-full ${status !== "idle" ? "pointer-events-none opacity-50" : ""}`}
      >
        {confirmLabel}
      </ButtonLink>
```

- [ ] **Step 3: 페이지가 `returnTo`를 읽어 넘긴다**

`src/app/register/place/page.tsx`의 import에 더한다:

```ts
import { readReturnTo } from "../../../lib/places/location";
```

`searchParams` 구조분해에 `returnTo`를 추가한다. 현재 줄:

```ts
  const { name, address, lat, lng } = await props.searchParams;
```

바꿀 것:

```ts
  const { name, address, lat, lng, returnTo } = await props.searchParams;
```

`center` 계산 아래에 넣는다:

```ts
  // 사용자가 URL에 무엇이든 넣을 수 있으므로 내부 경로만 통과시킨다.
  const backTo = readReturnTo(returnTo, "/register");
  const isEditing = backTo !== "/register";
```

`PlaceLocationPicker`에 넘긴다:

```tsx
        <PlaceLocationPicker
          initialName={selectedName}
          initialAddress={initialAddress}
          initialCenter={center}
          clientId={NAVER_MAP_CLIENT_ID}
          returnTo={backTo}
          confirmLabel={isEditing ? "이 위치로 변경하기" : "이 위치로 등록하기"}
        />
```

- [ ] **Step 4: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

- [ ] **Step 5: 오픈 리다이렉트 방어를 확인한다**

로그인한 브라우저에서 각각 열고, "이 위치로 …" 버튼의 `href`를 확인한다.

| URL | 기대 |
| --- | --- |
| `/register/place?returnTo=//evil.com` | `/register?…`로 간다. 문구는 "이 위치로 등록하기" |
| `/register/place?returnTo=https://evil.com` | 같음 |
| `/register/place?returnTo=/restaurants/abc/edit` | `/restaurants/abc/edit?…`, 문구는 "이 위치로 변경하기" |

확인은 개발자도구 콘솔에서:

```js
document.querySelector('a[href*="?name="]')?.getAttribute("href")
```

- [ ] **Step 6: 커밋**

```bash
git add src/lib/places/location.ts src/components/places/PlaceLocationPicker.tsx src/app/register/place/page.tsx
git commit -m "feat: 장소 선택 화면에 돌아갈 경로(returnTo) 추가"
```

---

### Task 2: 폼을 수정까지 겸하게 한다

**Files:**
- Rename + Modify: `src/components/places/PlaceRegisterForm.tsx` → `src/components/places/PlaceForm.tsx`
- Modify: `src/app/register/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `readReturnTo`(간접), 기존 `PlaceDto`
- Produces: `PlaceForm({ location, place? })`

- [ ] **Step 1: 파일 이름을 바꾼다**

```bash
git mv src/components/places/PlaceRegisterForm.tsx src/components/places/PlaceForm.tsx
```

- [ ] **Step 2: props와 상태를 넓힌다**

import에 `PlaceImageDto`를 더한다(`./dto`가 아니라 `../../lib/places/dto`):

```ts
  PLACE_TITLE_MAX_LENGTH,
  type PlaceDto,
  type PlaceImageDto,
} from "../../lib/places/dto";
```

인터페이스와 이름을 바꾼다:

```tsx
export interface PlaceFormProps {
  /** 앞 화면에서 고른 장소. 이름은 비어 있을 수 있다. */
  location: PlaceLocationDraft;
  /**
   * 고칠 글. 없으면 새 글이다.
   *
   * `mode: "edit"` 같은 플래그를 쓰지 않는 이유: 플래그를 두면 "수정인데 글이
   * 없는" 상태가 타입상 가능해진다.
   */
  place?: PlaceDto;
}

/**
 * 맛집 등록·수정 폼 — design.pen `03 Register Page - Place Entry`.
 *
 * 등록과 수정이 한 컴포넌트인 이유: 다른 것은 초기값, 사진 두 종류, 요청 세
 * 가지뿐이고 필드·검증·에러 표시는 전부 같다. 나누면 그 전부가 두 벌이 되고
 * 한쪽만 고치는 날이 온다.
 *
 * 제출은 `ProfileEditForm`과 같은 방식이다. `FormData`를 만들어 BFF 라우트에
 * 보내고, 성공하면 그 글로 이동한다. 서버 액션을 새로 만들지 않는 이유는 그
 * 라우트와 입력 검증이 이미 있어서다 — 같은 규칙을 부르는 입구가 둘이 되면
 * 언젠가 갈라진다.
 *
 * 주소는 입력 칸이 아니다. 손으로 고치면 좌표와 어긋나 상세 화면이 거짓말을 한다.
 */
export function PlaceForm({ location, place }: PlaceFormProps) {
  const router = useRouter();

  const [name, setName] = useState(location.name);
  const [title, setTitle] = useState(place?.title ?? "");
  const [content, setContent] = useState(place?.content ?? "");
  /** 그대로 둘 기존 사진. 지우면 여기서 빠지고 서버가 실제로 지운다. */
  const [kept, setKept] = useState<PlaceImageDto[]>(place?.images ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const imageCount = kept.length + files.length;

  const canSave =
    !saving &&
    name.trim() !== "" &&
    title.trim() !== "" &&
    content.trim().length >= PLACE_CONTENT_MIN_LENGTH &&
    imageCount > 0;
```

- [ ] **Step 3: 개수 계산을 `imageCount`로 바꾼다**

`addFiles` 안의 `const room = PLACE_IMAGE_MAX_COUNT - files.length;`를 바꾼다:

```ts
    const room = PLACE_IMAGE_MAX_COUNT - imageCount;
```

그리고 기존 사진을 지우는 함수를 `removeFile` 옆에 추가한다:

```ts
  function removeKept(path: string) {
    setKept(kept.filter((image) => image.path !== path));
  }
```

- [ ] **Step 4: 제출을 등록·수정으로 가른다**

`handleSubmit`의 본문에서 `body` 조립 뒤부터 바꾼다:

```ts
    const body = new FormData();
    body.append("title", title.trim());
    body.append("content", content.trim());
    body.append("name", name.trim());
    body.append("address", location.address);
    body.append("lat", String(location.lat));
    body.append("lng", String(location.lng));
    for (const file of files) body.append("images", file);
    // 수정은 "바뀐 것"이 아니라 "최종 상태"를 보낸다. 여기 없는 기존 사진은
    // 서버가 지운다.
    for (const image of kept) body.append("keepImagePaths", image.path);

    try {
      const response = await fetch(
        place ? `/api/places/${place.id}` : "/api/places",
        { method: place ? "PATCH" : "POST", body },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(
          payload?.error?.message ??
            "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }

      const saved = (await response.json()) as PlaceDto;
      // 목록 화면들이 서버 컴포넌트라, 캐시를 비우지 않으면 방금 쓴 글이 안 보인다.
      router.push(`/restaurants/${saved.id}`);
      router.refresh();
    } catch (reason) {
      console.error("[PlaceForm] 저장 실패", reason);
```

- [ ] **Step 5: 사진 목록에 기존 사진을 함께 그린다**

`{files.length > 0 && ( … )}` 블록을 통째로 바꾼다:

```tsx
      {imageCount > 0 && (
        <ul className="flex flex-col gap-2">
          {kept.map((image) => (
            <li key={image.path}>
              <FileItem
                name={image.path.split("/").at(-1) ?? image.path}
                status="등록된 사진"
                onDelete={() => removeKept(image.path)}
              />
            </li>
          ))}
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <FileItem
                name={file.name}
                status="선택됨"
                onDelete={() => removeFile(index)}
              />
            </li>
          ))}
        </ul>
      )}
```

`Dropzone`의 두 곳도 `files.length` → `imageCount`로 바꾼다:

```tsx
      <Dropzone
        state={imageCount === 0 ? "error" : "default"}
        helperText={`${IMAGE_LABELS} · 최대 ${MAX_MB}MB · ${PLACE_IMAGE_MAX_COUNT}장까지`}
        guideText={
          imageCount === 0 ? "사진을 1장 이상 올려주세요" : "끌어다 놓거나"
        }
```

- [ ] **Step 6: "장소 다시 선택"이 돌아올 곳을 알려 준다**

`Card` 안의 `ButtonLink` `href`를 바꾼다:

```tsx
        <ButtonLink
          href={`/register/place?${locationDraftToQuery({ ...location, name })}${
            place ? `&returnTo=${encodeURIComponent(`/restaurants/${place.id}/edit`)}` : ""
          }`}
          variant="secondary"
          leadingIcon="search"
          className="mt-1 w-full"
        >
          장소 다시 선택
        </ButtonLink>
```

- [ ] **Step 7: 저장 버튼 문구를 모드에 맞춘다**

```tsx
      <Button
        type="submit"
        disabled={!canSave}
        leadingIcon="check"
        className="mt-1 w-full"
      >
        {saving
          ? "저장 중…"
          : canSave
            ? place
              ? "수정 저장"
              : "저장"
            : "필수 항목 확인 후 저장"}
      </Button>
```

- [ ] **Step 8: 등록 페이지의 import를 고친다**

`src/app/register/page.tsx`:

```ts
import { PlaceForm } from "../../components/places/PlaceForm";
```

그리고 사용처:

```tsx
        <PlaceForm location={location} />
```

- [ ] **Step 9: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

- [ ] **Step 10: 등록이 그대로 되는지 확인한다 (회귀)**

`/register/place`에서 장소를 고르고 등록 화면으로 넘어가 폼이 이전과 같이 보이는지
확인한다. 저장까지 하지 않아도 된다 — Task 3에서 전 구간을 돈다.

- [ ] **Step 11: 커밋**

```bash
git add src/components/places/PlaceForm.tsx src/app/register/page.tsx
git commit -m "feat: 등록 폼을 수정까지 겸하도록 확장"
```

---

### Task 3: 수정 화면과 진입점

**Files:**
- Create: `src/app/restaurants/[id]/edit/page.tsx`
- Modify: `src/app/restaurants/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 2의 `PlaceForm`, 기존 `getPlace`, `readLocationDraftFromQuery`
- Produces: `/restaurants/{id}/edit`

- [ ] **Step 1: 수정 화면을 만든다**

`src/app/restaurants/[id]/edit/page.tsx` 생성:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Icon } from "../../../../components/foundation/Icon";
import { AppShell } from "../../../../components/layout/AppShell";
import { PageContainer } from "../../../../components/layout/PageContainer";
import { PlaceForm } from "../../../../components/places/PlaceForm";
import { NotFoundError } from "../../../../lib/api/http";
import { getCurrentUser } from "../../../../lib/auth/session";
import type { PlaceDto } from "../../../../lib/places/dto";
import { readLocationDraftFromQuery } from "../../../../lib/places/location";
import { getPlace } from "../../../../lib/places/service";

/**
 * 맛집 수정.
 *
 * `/restaurants/**`는 미들웨어의 보호 목록(`/my`, `/register`)에 없다. 그래서
 * 권한을 여기서 직접 본다 — 내 글이 아니면 `notFound()`다. `updatePlace`도 403을
 * 주지만 그건 저장 버튼을 누른 뒤고, 남의 글 내용이 폼에 채워지는 것 자체가 새는
 * 것이다.
 *
 * 403이 아니라 404인 이유: "남의 글이라 못 고친다"는 응답은 그 글이 있다는 사실을
 * 알려 준다. 없는 글과 같이 다루면 화면도 하나 덜 만든다.
 *
 * 장소는 세 곳에서 온다. 쿼리(장소를 바꾸고 돌아온 경우) → 글에 저장된 값 →
 * 둘 다 없으면 장소 선택으로 보낸다. 세 번째는 지도 정보가 필수가 되기 전에
 * 들어온 행이다.
 */
export default async function PlaceEditPage(
  props: PageProps<"/restaurants/[id]/edit">,
) {
  const { id } = await props.params;

  const viewer = await getCurrentUser();
  const place = await loadOwnPlace(id, viewer?.id ?? null);

  const editPath = `/restaurants/${place.id}/edit`;
  const location = readLocationDraftFromQuery(await props.searchParams) ?? place.location;
  if (!location) {
    redirect(`/register/place?returnTo=${encodeURIComponent(editPath)}`);
  }

  return (
    <AppShell tabBar={false}>
      {/* Phone top bar — replaced by SiteHeader from md. */}
      <div className="sticky top-0 z-30 border-b border-border-default bg-background-surface md:hidden">
        <div className="flex h-14 items-center justify-between px-3">
          <Link
            href={`/restaurants/${place.id}`}
            aria-label="닫기"
            className="flex size-6 items-center justify-center text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
          >
            <Icon name="close" size={24} />
          </Link>
          <h1 className="type-heading-sm text-text-default">맛집 수정</h1>
          <span className="size-6" aria-hidden />
        </div>
      </div>

      <PageContainer
        as="main"
        width="form"
        className="flex flex-col gap-4 py-4 md:py-32"
      >
        <h1 className="hidden type-display-sm text-text-default md:block">
          맛집 수정
        </h1>

        <PlaceForm location={location} place={place} />
      </PageContainer>
    </AppShell>
  );
}

/** 내 글만 돌려준다. 없는 글·지운 글·남의 글은 모두 404다. */
async function loadOwnPlace(
  id: string,
  viewerId: string | null,
): Promise<PlaceDto> {
  try {
    const place = await getPlace(id, viewerId);
    if (!place.isMine) notFound();
    return place;
  } catch (reason) {
    if (reason instanceof NotFoundError) notFound();
    throw reason;
  }
}
```

`readLocationDraftFromQuery`는 `PlaceLocationDraft`를, `place.location`은
`PlaceLocation`을 준다. 둘 다 `{ name, address, lat, lng }` 모양이라 그대로 섞인다.

- [ ] **Step 2: 상세에 "수정" 버튼을 단다**

`src/app/restaurants/[id]/page.tsx`의 import에 더한다:

```ts
import { ButtonLink } from "../../../components/ui/ButtonLink";
```

`<section aria-labelledby="place-location" …>` 블록 **뒤**, `{rest.length > 0 && …}` 앞에 넣는다:

```tsx
        {/*
          `isMine`은 지금까지 계산만 되고 쓰이지 않았다. 여기가 그 자리다.
          삭제는 마이페이지에 이미 있어 여기 두지 않는다.
        */}
        {place.isMine && (
          <ButtonLink
            href={`/restaurants/${place.id}/edit`}
            variant="secondary"
            leadingIcon="edit"
            className="w-full"
          >
            수정
          </ButtonLink>
        )}
```

- [ ] **Step 3: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

`leadingIcon="edit"`이 타입 에러를 내면 `src/tokens/icons.ts`에서 실제 이름을 확인해
바꾼다(마이페이지가 `<Icon name="edit" …>`를 쓰고 있으므로 있을 가능성이 높다).

- [ ] **Step 4: 전 구간을 돈다**

| # | 절차 | 기대 |
| --- | --- | --- |
| 1 | 내 글 상세 | "수정" 버튼이 보인다 |
| 2 | 로그아웃 상태의 같은 글 | 버튼이 없다 |
| 3 | "수정" 클릭 | 제목·내용·장소명·사진·주소가 채워져 있다 |
| 4 | 제목·내용을 바꿔 "수정 저장" | 상세로 돌아가고 값이 바뀌어 있다 |
| 5 | 기존 사진을 지우고 새 사진 추가 후 저장 | 상세의 사진이 바뀐다 |
| 6 | 사진을 전부 지움 | 저장 버튼 비활성 |
| 7 | "장소 다시 선택" | 버튼 문구가 "이 위치로 변경하기", 누르면 수정 화면으로 돌아온다 |
| 8 | 장소를 바꿔 저장 | 상세 지도·주소가 바뀐다 |
| 9 | 남의 글 `/restaurants/{남의 id}/edit` | 404 |
| 10 | 등록 흐름 전체 (회귀) | 그대로 동작한다 |

9번의 "남의 글"은 지금 DB에 없으므로, 로그아웃 상태로 내 글의 `/edit`에 접근해
404가 나오는 것으로 갈음한다(`isMine`이 false가 되는 같은 경로다).

- [ ] **Step 5: DB를 확인한다**

Supabase MCP:

```sql
select id, title, name, address, lat, lng
from public.place
where deleted_at is null
order by created_at desc
limit 3;
```

Expected: 수정한 값이 반영되어 있다.

- [ ] **Step 6: 커밋**

```bash
git add "src/app/restaurants/[id]/edit/page.tsx" "src/app/restaurants/[id]/page.tsx"
git commit -m "feat: 맛집 수정 화면 추가"
```

---

## 완료 조건

- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run lint` 통과
- [ ] Task 1 Step 5의 오픈 리다이렉트 방어 3가지
- [ ] Task 3 Step 4의 10개 시나리오
- [ ] DB에 수정 결과 반영 확인
- [ ] `git status`에 임시 디버그 코드가 없다
