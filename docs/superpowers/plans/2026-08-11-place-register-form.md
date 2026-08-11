# 맛집 등록 폼 배선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고른 장소를 `/register`로 넘기고, 목업이던 등록 폼을 실제로 배선해 `POST /api/places`로 저장한다.

**Architecture:** 장소를 먼저 고르는 순서다. `/register`는 주소·좌표가 없으면 `/register/place`로 리다이렉트한다. 쿼리 ↔ 장소 변환은 `lib/places/location.ts` 한 곳에 모은다. 폼은 `ProfileEditForm`과 같은 클라이언트 `fetch` 패턴이고, 이미 있는 `POST /api/places`와 `readCreatePlaceInput`을 재사용한다.

**Tech Stack:** Next.js 16.2.12 (App Router), React 19.2.4, TypeScript 5, Tailwind v4

설계 문서: `docs/superpowers/specs/2026-08-11-place-register-form-design.md`

## Global Constraints

- 테스트 러너가 없다. 검증은 `npx tsc --noEmit`, `npm run lint`, Storybook, 브라우저, Supabase MCP.
- `src/components/foundation/*`, `src/components/ui/*`를 재사용한다. 신규 구현·복제·인라인 스타일 금지. 색상·타이포·스페이싱은 토큰만.
- `globals.css`가 `--spacing-8/12/16/20/24/32`를 px 토큰으로 덮어쓴다. 그 숫자들은 Tailwind 스케일이 아니다.
- 컴포넌트 API를 바꾸면 스토리를 같이 갱신한다.
- 변경(mutation)은 Route Handler를 통한다. 서버 액션을 새로 만들지 않는다.
- 폼 필드 이름은 `readCreatePlaceInput`이 기대하는 그대로다: `title`, `content`, `images`, `name`, `address`, `lat`, `lng`.
- 커밋 메시지는 한국어.
- 작업 브랜치는 `feat/naver-reverse-geocoding`이다. 이미 체크아웃되어 있다.

## 파일 구조

| 파일 | 상태 | 책임 | Task |
| --- | --- | --- | --- |
| `src/lib/places/location.ts` | 신규 | 쿼리 ↔ `PlaceLocationDraft` | 1 |
| `src/components/ui/FileUploader.tsx` | 수정 | `Dropzone`에 실제 파일 입력 | 2 |
| `src/stories/ui/Form.stories.tsx` | 수정 | Dropzone 스토리 | 2 |
| `src/components/places/PlaceLocationPicker.tsx` | 수정 | 현재 좌표 상태 + "이 위치로 등록하기" | 3 |
| `src/app/register/place/page.tsx` | 수정 | 하단 버튼 제거(picker로 이동) | 3 |
| `src/components/places/PlaceRegisterForm.tsx` | 신규 | 등록 폼 | 4 |
| `src/app/register/page.tsx` | 수정 | 리다이렉트 + 폼 배선 | 4 |

---

### Task 1: 쿼리 ↔ 장소 변환

**Files:**
- Create: `src/lib/places/location.ts`

**Interfaces:**
- Consumes: `parseLatLng`(`@/lib/local-search/parse`)
- Produces:
  - `interface PlaceLocationDraft { name: string; address: string; lat: number; lng: number }`
  - `readLocationDraftFromQuery(params): PlaceLocationDraft | null`
  - `locationDraftToQuery(draft: PlaceLocationDraft): string`

- [ ] **Step 1: 파일을 만든다**

```ts
import { parseLatLng } from "@/lib/local-search/parse";

/**
 * 화면 사이를 쿼리로 오가는 장소.
 *
 * `PlaceLocation`(완성형)과 다른 점은 `name`이 비어 있을 수 있다는 것뿐이다.
 * 지도를 드래그해 위치를 잡으면 상호명이 없고, 그 이름은 등록 폼에서 받는다.
 * 이름까지 요구하면 그 사용자는 등록 화면에 들어가지도 못한다.
 */
export interface PlaceLocationDraft {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * 쿼리 → 장소. 주소와 좌표가 성해야 한다.
 *
 * 읽고 쓰는 곳이 세 군데(`/register`, `/register/place`, 폼의 "장소 다시 선택")라
 * 각자 적으면 파라미터 이름 하나가 어긋나는 날이 온다. 여기 하나만 둔다.
 */
export function readLocationDraftFromQuery(
  params: Record<string, string | string[] | undefined>,
): PlaceLocationDraft | null {
  const address = readParam(params.address);
  if (address === "") return null;

  const coords = parseLatLng(readParam(params.lat), readParam(params.lng));
  if (!coords) return null;

  return { name: readParam(params.name), address, ...coords };
}

export function locationDraftToQuery(draft: PlaceLocationDraft): string {
  return new URLSearchParams({
    name: draft.name,
    address: draft.address,
    lat: String(draft.lat),
    lng: String(draft.lng),
  }).toString();
}

/** 같은 이름으로 두 번 실려 오면 배열이 된다. 그때는 없는 것으로 본다. */
function readParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}
```

`parseLatLng`는 `unknown`을 받아 문자열이 아니면 `null`을 주므로 `readParam`의
빈 문자열을 그대로 넘겨도 안전하다.

- [ ] **Step 2: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

- [ ] **Step 3: 커밋**

```bash
git add src/lib/places/location.ts
git commit -m "feat: 쿼리와 장소 사이 변환을 한 곳에 모음"
```

---

### Task 2: Dropzone에 실제 파일 입력

**Files:**
- Modify: `src/components/ui/FileUploader.tsx`
- Modify: `src/stories/ui/Form.stories.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `DropzoneProps.accept?: string`, `DropzoneProps.multiple?: boolean`, `DropzoneProps.onFilesSelected?: (files: File[]) => void`

- [ ] **Step 1: import와 props를 넓힌다**

`FileUploader.tsx` 맨 위 import에 `useId`, `useRef`를 더한다. 이 파일은 아직
`"use client"`가 없으므로 맨 첫 줄에 넣는다 — 파일 입력과 ref를 쓰기 때문이다.

```tsx
"use client";

import { useId, useRef } from "react";

import { Icon } from "../foundation/Icon";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { FOCUS_RING } from "./field";
```

`DropzoneProps`에 세 줄을 더한다:

```ts
  /** `<input type="file">`의 accept. 예: "image/jpeg,image/png". */
  accept?: string;
  multiple?: boolean;
  /**
   * 고른 파일. 같은 파일을 다시 고를 수 있도록 값은 매번 비운다.
   *
   * `onSelect`와 함께 남긴 이유: 파일 없이 눌림만 필요한 자리가 있고,
   * 지우면 기존 스토리가 깨진다.
   */
  onFilesSelected?: (files: File[]) => void;
```

- [ ] **Step 2: Dropzone 본문을 고친다**

시그니처:

```tsx
export function Dropzone({
  state = "default",
  helperText,
  guideText = "끌어다 놓거나",
  accept,
  multiple,
  onSelect,
  onFilesSelected,
  className,
}: DropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isError = state === "error";
  const isDisabled = state === "disabled";
```

`<Button …>파일 선택</Button>`을 이것으로 바꾼다:

```tsx
        {/*
          입력을 투명하게 겹치지 않고 `sr-only` + `label`을 쓴다. 투명 입력을
          박스 위에 깔면 키보드 포커스 링이 글자가 아니라 빈 사각형에 그려진다.
        */}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={isDisabled}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) onFilesSelected?.(files);
            // 같은 파일을 지웠다가 다시 고를 수 있게 값을 비운다. 비우지 않으면
            // 두 번째 선택에서 change가 발생하지 않는다.
            event.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          leadingIcon="plus"
          disabled={isDisabled}
          onClick={() => {
            onSelect?.();
            inputRef.current?.click();
          }}
        >
          파일 선택
        </Button>
```

- [ ] **Step 3: 스토리에 실제 선택 예시를 추가한다**

`src/stories/ui/Form.stories.tsx`의 361행 근처 `<Dropzone helperText="JPG, PNG · 최대 5MB" />`를
찾아 그 바로 아래 형제로 추가한다. 그 `Specimen`의 구조를 그대로 따르되 label과
description만 바꾼다:

```tsx
          <Dropzone
            helperText="JPG, PNG · 최대 5MB"
            accept="image/jpeg,image/png"
            multiple
            onFilesSelected={(files) =>
              console.log("[Dropzone] 선택한 파일", files.map((f) => f.name))
            }
          />
```

스토리에서 파일을 고르면 콘솔에 이름이 찍힌다. Storybook에 상태를 만들지 않는
이유는 이 스토리가 표현을 보여 주는 자리이기 때문이다.

- [ ] **Step 4: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

- [ ] **Step 5: Storybook으로 확인한다**

Run: `npm run storybook`
브라우저에서 Form 스토리의 Dropzone을 연다.
Expected: "파일 선택"을 누르면 파일 대화상자가 열린다. 파일을 고르면 콘솔에
`[Dropzone] 선택한 파일 [...]`이 찍힌다. 기존 상태 스토리(default/dragover/
disabled/error)가 그대로 보인다. 확인 후 서버를 끈다.

- [ ] **Step 6: 커밋**

```bash
git add src/components/ui/FileUploader.tsx src/stories/ui/Form.stories.tsx
git commit -m "feat: Dropzone에 실제 파일 입력 추가"
```

---

### Task 3: 고른 장소를 등록 화면으로 넘긴다

**Files:**
- Modify: `src/components/places/PlaceLocationPicker.tsx`
- Modify: `src/app/register/place/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `locationDraftToQuery`
- Produces: 없음 (화면 동작)

- [ ] **Step 1: picker가 현재 좌표를 상태로 든다**

`PlaceLocationPicker.tsx`의 import에 더한다:

```ts
import { locationDraftToQuery } from "../../lib/places/location";
import { ButtonLink } from "../ui/ButtonLink";
```

상태 선언부에 좌표를 추가한다. `const [status, setStatus] = useState…` 아래:

```ts
  // 지도가 멈출 때마다 갱신한다. "이 위치로 등록하기"가 이 값을 들고 간다 —
  // 서버가 그린 링크는 드래그로 바뀐 위치를 알 수 없다.
  const [center, setCenter] = useState(initialCenter);
```

- [ ] **Step 2: 드래그가 좌표도 갱신하게 한다**

`handleCenterChange` 안, `setName("")` 위에 한 줄 넣는다:

```ts
      setCenter(next);
```

그리고 콜백 인자 이름을 `next`로 바꾼다(현재는 `center`인데 위에서 만든 상태와
이름이 겹친다):

```ts
  const handleCenterChange = useCallback(
    (next: { lat: number; lng: number }) => {
      setCenter(next);
      // 지도를 움직였으면 고른 장소를 벗어난 것이다. 상호명을 그대로 두면
      // "예빈당 성수본점 / 서울특별시 광진구 …"처럼 화면이 거짓말을 한다.
      setName("");
      setStatus("loading");
      void fetchAddress(next);
    },
    [fetchAddress],
  );
```

- [ ] **Step 3: 버튼을 picker 안에 넣는다**

`</Card>` 다음, 닫는 `</>` 앞에 넣는다:

```tsx
      {/*
        서버가 그린 링크가 아니라 여기 있는 이유: 드래그로 바뀐 위치를 아는 것은
        이 컴포넌트뿐이다.

        주소를 조회하는 중이거나 실패했으면 막는다. 주소 없이 넘어가면 다음
        화면이 곧바로 되돌려보낸다.
      */}
      <ButtonLink
        href={`/register?${locationDraftToQuery({ name, address, ...center })}`}
        aria-disabled={status !== "idle"}
        className={`w-full ${status !== "idle" ? "pointer-events-none opacity-50" : ""}`}
      >
        이 위치로 등록하기
      </ButtonLink>
```

- [ ] **Step 4: 페이지에서 옛 버튼을 없앤다**

`src/app/register/place/page.tsx`에서 아래 블록을 지운다:

```tsx
        <ButtonLink href="/register" className="w-full">
          이 위치로 등록하기
        </ButtonLink>
```

`ButtonLink` import도 이 파일에서 더 쓰이지 않으면 함께 지운다(`tsc`/`lint`가
알려 준다).

파일 상단 JSDoc에서 아래 문단을 갱신한다:

기존:
```
 * 맛집 등록 폼 자체가 아직 배선 전이라(사진·이름·주소 어느 것도 저장되지 않는다),
 * "이 위치로 등록하기"는 고른 장소를 들고 돌아가지 않고 등록 화면으로만 돌아간다.
 * 폼에 상태가 생기는 시점에 같이 이어 붙일 자리다.
```

바꿀 것:
```
 * "이 위치로 등록하기"는 `PlaceLocationPicker` 안에 있다. 드래그로 바뀐 위치를
 * 아는 것이 그 컴포넌트뿐이라, 서버가 그린 링크로는 옛 좌표를 넘기게 된다.
```

- [ ] **Step 5: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

- [ ] **Step 6: 커밋**

```bash
git add src/components/places/PlaceLocationPicker.tsx src/app/register/place/page.tsx
git commit -m "feat: 고른 장소를 등록 화면으로 넘김"
```

(이 시점에 `/register`는 아직 목업이라 눌러도 옛 화면이 나온다. Task 4에서 받는다.)

---

### Task 4: 등록 폼 배선

**Files:**
- Create: `src/components/places/PlaceRegisterForm.tsx`
- Modify: `src/app/register/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `PlaceLocationDraft`/`locationDraftToQuery`, Task 2의 `Dropzone` 파일 입력, 기존 `FileItem`, `dto.ts` 상수, `POST /api/places`
- Produces: `PlaceRegisterForm` 컴포넌트

- [ ] **Step 1: 폼을 만든다**

`src/components/places/PlaceRegisterForm.tsx` 생성:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  PLACE_CONTENT_MAX_LENGTH,
  PLACE_CONTENT_MIN_LENGTH,
  PLACE_IMAGE_MAX_BYTES,
  PLACE_IMAGE_MAX_COUNT,
  PLACE_IMAGE_MIME_TYPES,
  PLACE_NAME_MAX_LENGTH,
  PLACE_TITLE_MAX_LENGTH,
  type PlaceDto,
} from "../../lib/places/dto";
import {
  locationDraftToQuery,
  type PlaceLocationDraft,
} from "../../lib/places/location";
import { Icon } from "../foundation/Icon";
import { Button } from "../ui/Button";
import { ButtonLink } from "../ui/ButtonLink";
import { Card } from "../ui/Card";
import { Dropzone, FileItem } from "../ui/FileUploader";
import { TextArea } from "../ui/TextArea";
import { TextField } from "../ui/TextField";

const IMAGE_ACCEPT = PLACE_IMAGE_MIME_TYPES.join(",");
const MAX_MB = Math.round((PLACE_IMAGE_MAX_BYTES / (1024 * 1024)) * 10) / 10;

export interface PlaceRegisterFormProps {
  /** 앞 화면에서 고른 장소. 이름은 비어 있을 수 있다. */
  location: PlaceLocationDraft;
}

/**
 * 맛집 등록 폼 — design.pen `03 Register Page - Place Entry`.
 *
 * 제출은 `ProfileEditForm`과 같은 방식이다. `FormData`를 만들어
 * `POST /api/places`에 보내고, 성공하면 만들어진 글로 이동한다. 서버 액션을
 * 새로 만들지 않는 이유는 그 라우트와 `readCreatePlaceInput`이 이미 있고
 * 검증까지 끝나 있어서다 — 같은 규칙을 부르는 입구가 둘이 되면 언젠가 갈라진다.
 *
 * 주소는 입력 칸이 아니다. 손으로 고치면 좌표와 어긋나 상세 화면이 거짓말을 한다.
 * 바꾸려면 "장소 다시 선택"으로 지도 화면에 돌아간다.
 */
export function PlaceRegisterForm({ location }: PlaceRegisterFormProps) {
  const router = useRouter();

  const [name, setName] = useState(location.name);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave =
    !saving &&
    name.trim() !== "" &&
    title.trim() !== "" &&
    content.trim().length >= PLACE_CONTENT_MIN_LENGTH &&
    files.length > 0;

  /**
   * 고른 파일을 담는다. 형식·크기·개수를 여기서 미리 거른다.
   *
   * 서버도 같은 규칙을 갖고 있지만, 5MB짜리를 올렸다 400을 받는 왕복은 아깝다.
   * 최종 판단은 서버다 — 여기 검증은 우회할 수 있다.
   */
  function addFiles(picked: File[]) {
    const rejected: string[] = [];
    const accepted: File[] = [];

    for (const file of picked) {
      if (!(PLACE_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
        rejected.push(`${file.name}은(는) 지원하지 않는 형식입니다.`);
        continue;
      }
      if (file.size > PLACE_IMAGE_MAX_BYTES) {
        rejected.push(`${file.name}은(는) ${MAX_MB}MB를 넘습니다.`);
        continue;
      }
      accepted.push(file);
    }

    const room = PLACE_IMAGE_MAX_COUNT - files.length;
    const taken = accepted.slice(0, Math.max(room, 0));
    if (accepted.length > taken.length) {
      rejected.push(`사진은 ${PLACE_IMAGE_MAX_COUNT}장까지 올릴 수 있습니다.`);
    }

    if (taken.length > 0) setFiles([...files, ...taken]);
    setError(rejected.length > 0 ? rejected.join(" ") : null);
  }

  function removeFile(index: number) {
    setFiles(files.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);

    const body = new FormData();
    body.append("title", title.trim());
    body.append("content", content.trim());
    body.append("name", name.trim());
    body.append("address", location.address);
    body.append("lat", String(location.lat));
    body.append("lng", String(location.lng));
    for (const file of files) body.append("images", file);

    try {
      const response = await fetch("/api/places", { method: "POST", body });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(
          payload?.error?.message ??
            "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }

      const place = (await response.json()) as PlaceDto;
      // 목록 화면들이 서버 컴포넌트라, 캐시를 비우지 않으면 방금 쓴 글이 안 보인다.
      router.push(`/restaurants/${place.id}`);
      router.refresh();
    } catch (reason) {
      console.error("[PlaceRegisterForm] 등록 실패", reason);
      setError(
        reason instanceof Error
          ? reason.message
          : "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div
          className="flex gap-2 rounded-2xl border border-border-error-subtle bg-background-error p-3"
          role="alert"
        >
          <span className="shrink-0 text-text-error" aria-hidden>
            <Icon name="error" size={20} />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="type-label-lg text-text-error">저장할 수 없어요</p>
            <p className="type-label-md text-text-muted">{error}</p>
          </div>
        </div>
      )}

      <Dropzone
        state={files.length === 0 ? "error" : "default"}
        helperText={`${PLACE_IMAGE_MIME_TYPES.map((type) => type.split("/")[1].toUpperCase()).join(", ")} · 최대 ${MAX_MB}MB · ${PLACE_IMAGE_MAX_COUNT}장까지`}
        guideText={
          files.length === 0 ? "사진을 1장 이상 올려주세요" : "끌어다 놓거나"
        }
        accept={IMAGE_ACCEPT}
        multiple
        onFilesSelected={addFiles}
      />

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
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

      {/* 고른 장소. 주소는 읽기 전용이고 바꾸려면 지도 화면으로 돌아간다. */}
      <Card>
        <p className="type-label-md text-text-brand">선택한 위치</p>
        <p className="type-body-lg text-text-default">{location.address}</p>
        <ButtonLink
          href={`/register/place?${locationDraftToQuery({ ...location, name })}`}
          variant="secondary"
          leadingIcon="search"
          className="mt-1 w-full"
        >
          장소 다시 선택
        </ButtonLink>
      </Card>

      <TextField
        label="장소명"
        name="name"
        value={name}
        maxLength={PLACE_NAME_MAX_LENGTH}
        onChange={(event) => setName(event.target.value)}
        placeholder="예: 예빈당 성수본점"
        helperText="검색으로 고르면 자동으로 채워집니다"
        error={name.trim() === "" ? "필수 입력 항목입니다" : undefined}
      />

      <TextField
        label="맛집 이름"
        name="title"
        value={title}
        maxLength={PLACE_TITLE_MAX_LENGTH}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="맛집 이름을 입력하세요"
        error={title.trim() === "" ? "필수 입력 항목입니다" : undefined}
      />

      <TextArea
        label="소개 / 후기"
        name="content"
        value={content}
        maxLength={PLACE_CONTENT_MAX_LENGTH}
        showCounter
        onChange={(event) => setContent(event.target.value)}
        placeholder="차로 가기 좋은 곳이에요"
        error={
          content.trim().length > 0 &&
          content.trim().length < PLACE_CONTENT_MIN_LENGTH
            ? `${PLACE_CONTENT_MIN_LENGTH}자 이상 적어 주세요`
            : undefined
        }
      />

      <Button
        type="submit"
        disabled={!canSave}
        leadingIcon="check"
        className="mt-1 w-full"
      >
        {saving ? "저장 중…" : canSave ? "저장" : "필수 항목 확인 후 저장"}
      </Button>
    </form>
  );
}
```

주소 길이 상한(`PLACE_ADDRESS_MAX_LENGTH`)은 import 하지 않는다. 주소는 사용자가
입력하지 않고 앞 화면에서 그대로 실려 오며, 검사는 서버가 한다.

- [ ] **Step 2: 페이지를 배선한다**

`src/app/register/page.tsx`를 통째로 바꾼다:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";

import { Icon } from "../../components/foundation/Icon";
import { AppShell } from "../../components/layout/AppShell";
import { PageContainer } from "../../components/layout/PageContainer";
import { PlaceRegisterForm } from "../../components/places/PlaceRegisterForm";
import { readLocationDraftFromQuery } from "../../lib/places/location";

/**
 * 맛집 등록 — design.pen `03 Register Page - Place Entry`.
 *
 * 장소를 먼저 고르는 순서다. 주소와 좌표가 실려 오지 않았으면 `/register/place`로
 * 보낸다. "지도 정보는 필수"라는 규칙이 여기 한 곳에서 강제되고, 사용자는 빈 폼
 * 앞에서 무엇부터 해야 하나 고민하지 않는다.
 *
 * 장소명까지 요구하지는 않는다. 지도를 드래그해 위치를 잡으면 상호명이 없는데,
 * 그때 되돌려보내면 빠져나올 수 없는 고리가 된다. 이름은 폼에서 받는다.
 */
export default async function RegisterPage(props: PageProps<"/register">) {
  const location = readLocationDraftFromQuery(await props.searchParams);
  if (!location) {
    redirect("/register/place");
  }

  return (
    <AppShell tabBar={false}>
      {/* Phone top bar — replaced by SiteHeader from md. */}
      <div className="sticky top-0 z-30 border-b border-border-default bg-background-surface md:hidden">
        <div className="flex h-14 items-center justify-between px-3">
          <Link
            href="/"
            aria-label="닫기"
            className="flex size-6 items-center justify-center text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
          >
            <Icon name="close" size={24} />
          </Link>
          <h1 className="type-heading-sm text-text-default">맛집 등록</h1>
          <span className="size-6" aria-hidden />
        </div>
      </div>

      {/* 폼뿐인 화면이라 폭은 640에서 멈춘다. */}
      <PageContainer
        as="main"
        width="form"
        className="flex flex-col gap-4 py-4 md:py-32"
      >
        <h1 className="hidden type-display-sm text-text-default md:block">
          맛집 등록
        </h1>

        <PlaceRegisterForm location={location} />
      </PageContainer>
    </AppShell>
  );
}
```

"임시저장" 버튼은 지운다. 저장할 곳이 없어 눌리는 척만 하는 버튼이었고, 설계
문서의 범위 밖에 적혀 있다. 모바일 상단 바의 오른쪽 자리는 빈 `span`으로 채워
제목이 가운데 오게 한다.

`PageContainer`에 `width="form"`을 준다. 기존 코드는 `max-w-[640px]` div를 손으로
겹쳐 두었는데, CLAUDE.md가 "페이지에서 `max-w`를 직접 쓰지 않는다"고 못 박고 있고
`/register/place`가 이미 `width="form"`을 쓴다.

- [ ] **Step 3: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0). 미사용 import가 있으면 지운다.

- [ ] **Step 4: 리다이렉트를 확인한다**

로그인한 브라우저에서 `http://localhost:3000/register`를 연다.
Expected: `/register/place`로 이동한다.

- [ ] **Step 5: 전 구간을 돈다**

| # | 절차 | 기대 |
| --- | --- | --- |
| 1 | `/register/place`에서 "성수동 카페" 검색 → "예빈당 성수본점" 선택 | 지도와 주소가 성수동 |
| 2 | "이 위치로 등록하기" | `/register?name=예빈당…&address=…&lat=…&lng=…`로 이동, 폼의 장소명이 채워져 있다 |
| 3 | 사진 없이 저장 시도 | 버튼 비활성, Dropzone이 error 상태 |
| 4 | 사진 1장 + 맛집 이름 + 내용 10자 이상 | 버튼 활성 |
| 5 | 저장 | `/restaurants/{id}`로 이동. 사진·제목·내용·지도·마커·주소가 모두 맞다 |
| 6 | 홈 `/`과 `/my` | 새 글이 보이고 카드 meta에 성수동 주소 |
| 7 | 사진 6장 선택 | 5장만 담기고 배너에 "사진은 5장까지" |
| 8 | 5MB 넘는 파일 | 거부되고 배너에 이유 |
| 9 | 폼에서 "장소 다시 선택" | `/register/place`가 현재 장소를 들고 열린다 |
| 10 | `/register/place`에서 **검색 없이 드래그만** → "이 위치로 등록하기" | 폼의 장소명이 비어 있고 error 표시. 직접 채우면 저장된다 |
| 11 | 주소 조회 중 "이 위치로 등록하기" | 비활성 |

- [ ] **Step 6: DB를 확인한다**

Supabase MCP `execute_sql`:

```sql
select id, title, name, address, lat, lng, created_at
from public.place
where deleted_at is null
order by created_at desc
limit 3;
```

Expected: 방금 만든 행의 `name`/`address`/`lat`/`lng`가 모두 채워져 있다.

- [ ] **Step 7: 커밋**

```bash
git add src/components/places/PlaceRegisterForm.tsx src/app/register/page.tsx
git commit -m "feat: 맛집 등록 폼 배선"
```

---

## 완료 조건

- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run lint` 통과
- [ ] Task 4 Step 5의 11개 시나리오 확인
- [ ] Task 4 Step 6의 DB 확인
- [ ] Storybook의 Dropzone 스토리가 뜬다
- [ ] `git status`에 임시 디버그 코드가 남아 있지 않다

## 후속

- F: 맛집 수정 화면. `UpdatePlaceInput`과 `keepImagePaths`는 이미 준비되어 있다.
- 임시저장. 저장할 곳을 정하는 것이 먼저다.
- 드래그 앤 드롭 업로드(`Dropzone`의 `dragover` 상태를 실제로 쓰기).
