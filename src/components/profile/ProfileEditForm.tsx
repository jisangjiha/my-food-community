"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Icon } from "../foundation/Icon";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import {
  NICKNAME_MAX_LENGTH,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MIME_TYPES,
  type MyProfileDto,
} from "../../lib/profile/dto";

/**
 * 프로필 수정 폼.
 *
 * 클라이언트에서 Supabase를 부르지 않는다. 사진은 `PATCH /api/me/profile`로
 * 보내고, 업로드와 Storage 경로 짓기는 서버가 한다. 브라우저는 버킷 이름도
 * Storage 주소도 모른다.
 *
 * 닉네임과 사진을 한 요청으로 보내는 이유: 나눠 보내면 사진만 바뀌고 닉네임은
 * 실패하는 중간 상태가 생긴다. 사용자가 "저장"을 한 번 눌렀으면 결과도 하나여야 한다.
 */

const MAX_IMAGE_MB = Math.round((PROFILE_IMAGE_MAX_BYTES / (1024 * 1024)) * 10) / 10;

export interface ProfileEditFormProps {
  profile: MyProfileDto;
}

export function ProfileEditForm({ profile }: ProfileEditFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(profile.nickname);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 미리보기는 blob: URL이라 놓아 주기 전까지 브라우저가 파일을 붙들고 있다.
  // 정리 함수는 previewUrl이 바뀔 때(= 사진을 다시 골랐을 때)와 화면을 떠날 때
  // 모두 돌므로, 이 한 줄로 이전 URL과 마지막 URL이 함께 해제된다.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectFile(next: File) {
    // 서버도 같은 값으로 막지만, 왕복 없이 바로 알려 주는 편이 낫다.
    if (!(PROFILE_IMAGE_MIME_TYPES as readonly string[]).includes(next.type)) {
      setError("JPG, PNG, WEBP, GIF 형식만 올릴 수 있어요.");
      return;
    }
    if (next.size > PROFILE_IMAGE_MAX_BYTES) {
      setError(`사진은 ${MAX_IMAGE_MB}MB를 넘을 수 없어요.`);
      return;
    }

    setError(null);
    setFile(next);
    setRemoveImage(false);
    setPreviewUrl(URL.createObjectURL(next));
  }

  function clearImage() {
    setFile(null);
    setPreviewUrl(null);
    setRemoveImage(true);
    setError(null);
    // 같은 파일을 다시 고를 수 있도록 비운다. 값이 남아 있으면 change가 안 뜬다.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setError(null);
    setSaving(true);

    const body = new FormData();
    body.set("nickname", nickname);
    if (file) body.set("image", file);
    if (removeImage) body.set("removeImage", "true");

    try {
      // Content-Type을 직접 넣지 않는다. 브라우저가 multipart 경계 문자열까지
      // 붙여 줘야 서버가 파싱할 수 있다.
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        body,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(readErrorMessage(payload));
        return;
      }

      // 마이페이지는 서버 컴포넌트다. push만 하면 캐시된 예전 프로필이 보인다.
      router.push("/my");
      router.refresh();
    } catch {
      setError("네트워크가 불안정해요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  // 새로 고른 사진 → 지우기를 눌렀으면 비움 → 아니면 지금 쓰는 사진.
  const shownAvatarUrl = previewUrl ?? (removeImage ? null : profile.avatarUrl);
  const canRemoveImage = Boolean(previewUrl) || profile.hasCustomImage;
  const nicknameTooLong = nickname.trim().length > NICKNAME_MAX_LENGTH;
  const canSave =
    nickname.trim().length > 0 && !nicknameTooLong && !saving;

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

      <section className="flex items-center gap-3 rounded-2xl bg-background-surface p-3 md:p-4">
        <span
          className="relative flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-background-brand-muted text-text-brand"
          aria-hidden
        >
          {shownAvatarUrl ? (
            previewUrl ? (
              // 고르자마자 보여 주는 blob: URL이다. next/image의 최적화 서버는
              // 이 주소를 가져올 수 없으므로 여기만 <img>를 쓴다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Image
                src={shownAvatarUrl}
                alt=""
                fill
                sizes="72px"
                className="object-cover"
              />
            )
          ) : (
            <Icon name="user" size={32} />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon="image"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              사진 변경
            </Button>
            {canRemoveImage && (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon="delete"
                onClick={clearImage}
                disabled={saving}
              >
                기본 사진
              </Button>
            )}
          </div>
          <p className="type-label-md text-text-muted">
            {removeImage
              ? "저장하면 구글 계정 사진으로 돌아가요."
              : `JPG, PNG, WEBP, GIF · ${MAX_IMAGE_MB}MB 이하`}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          name="image"
          accept={PROFILE_IMAGE_MIME_TYPES.join(",")}
          className="hidden"
          onChange={(event) => {
            const next = event.target.files?.[0];
            if (next) selectFile(next);
          }}
        />
      </section>

      {/*
        maxLength로 자르지 않는다. 붙여 넣은 이름이 말없이 잘리는 것보다, 넘쳤다고
        알려 주고 사용자가 직접 줄이게 하는 편이 낫다. 대신 저장 버튼이 잠긴다.
      */}
      <TextField
        label="닉네임"
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        placeholder="이웃에게 보일 이름"
        autoComplete="nickname"
        disabled={saving}
        error={nicknameTooLong ? `${NICKNAME_MAX_LENGTH}자까지 쓸 수 있어요` : undefined}
        helperText={`${nickname.trim().length}/${NICKNAME_MAX_LENGTH}자`}
      />

      {/*
        grid로 나누는 이유: Button의 기본 클래스에 `shrink-0`이 들어 있어서
        `flex-1`을 덧붙여도 늘어나지 않는다. 칸을 격자로 먼저 정하면 버튼은
        `w-full`만으로 그 칸을 채운다.
      */}
      <div className="mt-1 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => router.push("/my")}
          disabled={saving}
        >
          취소
        </Button>
        <Button
          type="submit"
          leadingIcon="check"
          className="w-full"
          loading={saving}
          disabled={!canSave}
        >
          {saving ? "저장 중" : "저장"}
        </Button>
      </div>
    </form>
  );
}

/** BFF의 에러 규약(`{ error: { code, message } }`)에서 문구만 꺼낸다. */
function readErrorMessage(payload: unknown): string {
  const fallback = "프로필을 저장하지 못했어요.";
  if (typeof payload !== "object" || payload === null) return fallback;

  const { error } = payload as { error?: { message?: unknown } };
  return typeof error?.message === "string" ? error.message : fallback;
}
