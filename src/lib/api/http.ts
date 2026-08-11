import "server-only";

import { UnauthorizedError } from "@/lib/auth/session";

/**
 * BFF 응답 규약.
 *
 * Route Handler는 Supabase 응답을 그대로 흘려보내지 않는다. 성공은 DTO를,
 * 실패는 아래의 고정된 에러 모양을 돌려준다. 클라이언트가 Postgres 에러 코드나
 * 테이블 이름을 보게 되면 그건 스키마가 새어 나간 것이다.
 */

export interface ApiError {
  error: {
    /** 클라이언트가 분기할 수 있는 안정적인 코드. */
    code: string;
    /** 사용자에게 그대로 보여줄 수 있는 문구. */
    message: string;
  };
}

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function jsonError(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json({ error: { code, message } } satisfies ApiError, {
    status,
  });
}

/** 입력 검증 실패. 어떤 필드가 왜 틀렸는지는 message에 담는다. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** 요청한 리소스가 없음. */
export class NotFoundError extends Error {
  constructor(message = "찾을 수 없습니다.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * 로그인은 했지만 이 리소스에는 권한이 없음.
 *
 * 401과 구분한다. 401은 "누구인지 모르겠다"라서 로그인하면 풀리고, 403은
 * "너인 건 알겠는데 남의 글이다"라서 다시 로그인해도 소용없다. 같은 코드로
 * 묶으면 클라이언트가 로그인 화면으로 보내는 무의미한 순환을 만든다.
 */
export class ForbiddenError extends Error {
  constructor(message = "권한이 없습니다.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Route Handler 공통 래퍼.
 *
 * 알려진 예외는 의도한 상태 코드로, 나머지는 500 + 일반 문구로 바꾼다.
 * 원본 예외는 서버 로그에만 남긴다.
 */
export function withRoute<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (reason) {
      if (reason instanceof UnauthorizedError) {
        return jsonError(401, "unauthorized", reason.message);
      }
      if (reason instanceof ValidationError) {
        return jsonError(400, "invalid_request", reason.message);
      }
      if (reason instanceof ForbiddenError) {
        return jsonError(403, "forbidden", reason.message);
      }
      if (reason instanceof NotFoundError) {
        return jsonError(404, "not_found", reason.message);
      }

      console.error("[api] 처리되지 않은 오류", reason);
      return jsonError(
        500,
        "internal_error",
        "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
  };
}

/** JSON 본문을 읽는다. 파싱 실패는 400으로 떨어진다. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("JSON 본문을 읽을 수 없습니다.");
  }
}

/**
 * multipart/form-data 본문을 읽는다. 파일이 섞인 요청은 JSON으로 못 보낸다.
 *
 * Content-Type을 먼저 보는 이유: 아닌 요청에 `formData()`를 부르면 Next가
 * 던지는 파싱 에러가 500으로 새어 나간다. 형식 문제는 400이어야 한다.
 */
export async function readFormData(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new ValidationError("multipart/form-data 형식의 본문이 필요합니다.");
  }
  try {
    return await request.formData();
  } catch {
    throw new ValidationError("폼 본문을 읽을 수 없습니다.");
  }
}

/**
 * 필수 문자열 필드. 공백만 있는 값은 비어 있는 것으로 본다.
 *
 * `label`은 사용자에게 보일 이름이다. 없으면 필드명을 그대로 쓴다.
 */
export function requireString(
  source: Record<string, unknown>,
  field: string,
  { max, min = 1, label = field }: { max: number; min?: number; label?: string },
): string {
  const value = source[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${label}은(는) 필수입니다.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new ValidationError(`${label}은(는) ${min}자 이상이어야 합니다.`);
  }
  if (trimmed.length > max) {
    throw new ValidationError(`${label}은(는) ${max}자를 넘을 수 없습니다.`);
  }
  return trimmed;
}

/**
 * 선택 업로드 파일. 고르지 않았으면 null.
 *
 * 크기와 MIME 타입을 여기서 막는다. 버킷 정책에도 같은 제한을 둘 수 있지만,
 * 거기서 걸리면 Storage 에러가 되어 사용자에게 보여줄 문구가 없다.
 * 브라우저가 보낸 `type`은 신뢰할 수 없는 값이라 1차 방어일 뿐이고,
 * 실제 차단은 버킷 정책과 RLS가 맡는다.
 */
export function optionalFile(
  form: FormData,
  field: string,
  {
    maxBytes,
    mimeTypes,
    label = field,
  }: { maxBytes: number; mimeTypes: readonly string[]; label?: string },
): File | null {
  const value = form.get(field);
  const file = asPickedFile(value);
  if (!file) return null;

  assertFile(file, { maxBytes, mimeTypes, label });
  return file;
}

/**
 * 같은 이름으로 여러 번 실려 온 파일들. 하나도 고르지 않았으면 빈 배열.
 *
 * 개수 제한은 여기서 세지 않는다. 등록은 "1장 이상", 수정은 "남긴 것까지 합쳐
 * 1장 이상"이라 기준이 다르고, 그 판단은 도메인 쪽(`places/input.ts`)에 있다.
 * 이 함수는 파일 하나하나가 올릴 만한 것인지만 본다.
 */
export function readFiles(
  form: FormData,
  field: string,
  {
    maxBytes,
    mimeTypes,
    label = field,
  }: { maxBytes: number; mimeTypes: readonly string[]; label?: string },
): File[] {
  const files = form.getAll(field).flatMap((value) => {
    const file = asPickedFile(value);
    return file ? [file] : [];
  });

  for (const file of files) {
    assertFile(file, { maxBytes, mimeTypes, label });
  }

  return files;
}

/** 사용자가 실제로 고른 파일만 남긴다. 아니면 null. */
function asPickedFile(value: FormDataEntryValue | null): File | null {
  // 파일을 고르지 않은 <input type="file">은 크기 0짜리 File로 실려 온다.
  if (value === null || typeof value === "string" || value.size === 0) {
    return null;
  }
  return value;
}

function assertFile(
  file: File,
  {
    maxBytes,
    mimeTypes,
    label,
  }: { maxBytes: number; mimeTypes: readonly string[]; label: string },
): void {
  if (!mimeTypes.includes(file.type)) {
    throw new ValidationError(
      `${label}은(는) ${mimeTypes.map(toExtensionLabel).join(", ")} 형식만 올릴 수 있습니다.`,
    );
  }
  if (file.size > maxBytes) {
    const mb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
    throw new ValidationError(`${label}은(는) ${mb}MB를 넘을 수 없습니다.`);
  }
}

/** "image/jpeg" → "JPG". 에러 문구에 MIME 타입을 그대로 쓰지 않기 위한 것. */
function toExtensionLabel(mimeType: string): string {
  return mimeType.split("/").at(-1)?.toUpperCase() ?? mimeType;
}

/** 본문이 객체인지 확인하고 좁힌다. */
export function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("객체 형태의 본문이 필요합니다.");
  }
  return body as Record<string, unknown>;
}
