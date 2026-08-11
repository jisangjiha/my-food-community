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
  type PlaceImageDto,
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
const IMAGE_LABELS = PLACE_IMAGE_MIME_TYPES.map((type) =>
  type.split("/")[1].toUpperCase(),
).join(", ");

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
 * 바꾸려면 "장소 다시 선택"으로 지도 화면에 돌아간다.
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

    const room = PLACE_IMAGE_MAX_COUNT - imageCount;
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

  function removeKept(path: string) {
    setKept(kept.filter((image) => image.path !== path));
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
        state={imageCount === 0 ? "error" : "default"}
        helperText={`${IMAGE_LABELS} · 최대 ${MAX_MB}MB · ${PLACE_IMAGE_MAX_COUNT}장까지`}
        guideText={
          imageCount === 0 ? "사진을 1장 이상 올려주세요" : "끌어다 놓거나"
        }
        accept={IMAGE_ACCEPT}
        multiple
        onFilesSelected={addFiles}
      />

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

      {/* 고른 장소. 주소는 읽기 전용이고 바꾸려면 지도 화면으로 돌아간다. */}
      <Card>
        <p className="type-label-md text-text-brand">선택한 위치</p>
        <p className="type-body-lg text-text-default">{location.address}</p>
        <ButtonLink
          href={`/register/place?${locationDraftToQuery({ ...location, name })}${
            place
              ? `&returnTo=${encodeURIComponent(`/restaurants/${place.id}/edit`)}`
              : ""
          }`}
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
        {saving
          ? "저장 중…"
          : canSave
            ? place
              ? "수정 저장"
              : "저장"
            : "필수 항목 확인 후 저장"}
      </Button>
    </form>
  );
}
