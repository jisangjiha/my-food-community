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
const IMAGE_LABELS = PLACE_IMAGE_MIME_TYPES.map((type) =>
  type.split("/")[1].toUpperCase(),
).join(", ");

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
        helperText={`${IMAGE_LABELS} · 최대 ${MAX_MB}MB · ${PLACE_IMAGE_MAX_COUNT}장까지`}
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
