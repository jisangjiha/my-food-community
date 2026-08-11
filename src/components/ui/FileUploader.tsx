"use client";

import { useRef } from "react";

import { Icon } from "../foundation/Icon";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { FOCUS_RING } from "./field";

export type DropzoneState = "default" | "dragover" | "disabled" | "error";

/** Border per state, measured from design.pen. */
const DROPZONE_BORDER: Record<DropzoneState, string> = {
  default: "border border-border-strong",
  dragover: "border-2 border-border-brand",
  disabled: "border border-border-strong",
  error: "border-[1.5px] border-border-error",
};

export interface DropzoneProps {
  state?: DropzoneState;
  /** File type and size limits, shown above the box. */
  helperText?: string;
  /** Replaces the guide line and turns it red when state is `error`. */
  guideText?: string;
  /** `<input type="file">`의 accept. 예: "image/jpeg,image/png". */
  accept?: string;
  multiple?: boolean;
  onSelect?: () => void;
  /**
   * 고른 파일.
   *
   * `onSelect`와 함께 남긴 이유: 파일 없이 눌림만 필요한 자리가 있고, 지우면
   * 기존 스토리가 깨진다.
   */
  onFilesSelected?: (files: File[]) => void;
  className?: string;
}

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
  const inputRef = useRef<HTMLInputElement>(null);
  const isError = state === "error";
  const isDisabled = state === "disabled";

  return (
    <div
      className={`flex flex-col gap-1.5 ${isDisabled ? "opacity-50" : ""} ${className ?? ""}`}
    >
      {helperText && (
        <p className="type-label-md text-neutral-600">{helperText}</p>
      )}
      <div
        className={[
          "flex flex-col items-center justify-center gap-2 bg-background-surface p-4",
          DROPZONE_BORDER[state],
        ].join(" ")}
        style={{
          minHeight: 132,
          borderRadius: 14,
          boxShadow: state === "dragover" ? FOCUS_RING : undefined,
        }}
      >
        <span className={isError ? "text-text-error" : "text-text-brand"}>
          <Icon name="image" size={24} />
        </span>
        <p
          className={`type-body-md ${isError ? "text-text-error" : "text-neutral-600"}`}
        >
          {guideText}
        </p>
        {/*
          입력을 투명하게 겹치지 않고 `sr-only`로 숨긴다. 투명 입력을 박스 위에
          깔면 키보드 포커스 링이 글자가 아니라 빈 사각형에 그려진다.
        */}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={isDisabled}
          className="sr-only"
          tabIndex={-1}
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
      </div>
    </div>
  );
}

export type FileItemState = "uploading" | "complete" | "error";

const STATUS_TONE: Record<FileItemState, string> = {
  uploading: "text-text-brand",
  complete: "text-text-success",
  error: "text-text-error",
};

export interface FileItemProps {
  name: string;
  state?: FileItemState;
  /** e.g. "업로드 중 · 40%". Falls back to a default per state. */
  status?: string;
  onDelete?: () => void;
  className?: string;
}

const DEFAULT_STATUS: Record<FileItemState, string> = {
  uploading: "업로드 중",
  complete: "업로드 완료",
  error: "업로드 실패",
};

export function FileItem({
  name,
  state = "complete",
  status,
  onDelete,
  className,
}: FileItemProps) {
  return (
    <div
      className={`flex items-center gap-2.5 border border-border-default bg-background-surface ${className ?? ""}`}
      style={{ height: 56, borderRadius: 12, paddingInline: 10 }}
    >
      <div
        className="flex shrink-0 items-center justify-center bg-border-default text-text-subtle"
        style={{ width: 40, height: 40, borderRadius: 8 }}
        aria-hidden
      >
        <Icon name="image" size={20} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-body-md truncate text-text-default">{name}</span>
        <span className={`type-label-md truncate ${STATUS_TONE[state]}`}>
          {status ?? DEFAULT_STATUS[state]}
        </span>
      </div>

      <span className={`shrink-0 ${STATUS_TONE[state]}`}>
        {state === "uploading" ? (
          <Spinner size={20} label={null} />
        ) : (
          <Icon name={state === "complete" ? "check" : "error"} size={20} />
        )}
      </span>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`${name} 삭제`}
        className="shrink-0 cursor-pointer text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
      >
        <Icon name="delete" size={20} />
      </button>
    </div>
  );
}
