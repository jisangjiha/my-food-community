import "server-only";

import type { AuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_IMAGE_BUCKET, publicStorageUrl } from "@/lib/supabase/storage";
import {
  PROFILE_IMAGE_MIME_TYPES,
  type MyProfileDto,
  type UpdateProfileInput,
} from "./dto";

/**
 * 프로필 데이터 접근 계층.
 *
 * Supabase를 아는 코드는 여기까지다. Route Handler와 서버 컴포넌트는 이 함수들만
 * 부르고 DTO만 받는다.
 */

/**
 * 확장자는 MIME 타입에서 정한다. 클라이언트가 보낸 파일명은 쓰지 않는다.
 *
 * 키를 `PROFILE_IMAGE_MIME_TYPES`로 묶어 뒀으므로, 허용 목록에 형식을 추가하면
 * 여기에 확장자를 적기 전까지 타입 검사가 통과하지 않는다.
 */
const IMAGE_EXTENSIONS: Record<(typeof PROFILE_IMAGE_MIME_TYPES)[number], string> =
  {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

/** DB에서 읽는 프로필 한 줄. 밖으로 내보내지 않는다. */
interface ProfileRow {
  nickname: string;
  image_path: string | null;
}

/**
 * 마이페이지에 필요한 것을 한 번에 모은다.
 *
 * 프로필 행은 가입 트리거(`handle_new_user`)가 만든다. 그래도 없을 수 있는
 * 경우가 있어서 — 트리거보다 먼저 만들어진 계정 — 없으면 여기서 채워 넣는다.
 * 그 편이 마이페이지가 빈 화면으로 죽는 것보다 낫다.
 */
export async function getMyProfile(user: AuthUser): Promise<MyProfileDto> {
  const supabase = await createClient();

  const [{ data: profile, error }, { count, error: countError }] =
    await Promise.all([
      supabase
        .from("profile")
        .select("nickname, image_path")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("place")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        // 지운 글은 "등록" 수에 들어가지 않는다. 목록에는 없는데 숫자만 남으면
        // 사용자는 어디에 한 건이 숨어 있는지 찾게 된다.
        .is("deleted_at", null),
    ]);

  if (error) {
    console.error("[profile] 조회 실패", error);
    throw new Error("프로필을 불러오지 못했습니다.");
  }
  if (countError) {
    console.error("[profile] 등록 수 조회 실패", countError);
  }

  const row = profile ?? (await backfillProfile(user));

  return toDto(row, user, count ?? 0);
}

/**
 * 닉네임과 사진을 바꾼다.
 *
 * 순서가 중요하다: 사진을 먼저 올리고 그 다음에 행을 쓴다. 반대로 하면 업로드가
 * 실패했을 때 DB에 없는 파일을 가리키는 경로가 남는다. 이 순서면 최악의 경우
 * 참조되지 않는 파일 하나가 남을 뿐이다.
 */
export async function updateMyProfile(
  user: AuthUser,
  input: UpdateProfileInput,
): Promise<MyProfileDto> {
  const supabase = await createClient();

  // 예전 사진 경로를 먼저 알아 둔다. 갈아끼운 뒤에 지우려면 필요하다.
  const { data: current, error: readError } = await supabase
    .from("profile")
    .select("image_path")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) {
    console.error("[profile] 수정 전 조회 실패", readError);
    throw new Error("프로필을 불러오지 못했습니다.");
  }

  const previousPath = current?.image_path ?? null;
  const nextPath = input.image
    ? await uploadProfileImage(user.id, input.image)
    : input.removeImage
      ? null
      : previousPath;

  // update가 아니라 upsert인 이유: 트리거가 만들어 둔 행이 없는 계정에서도
  // update는 조용히 0행을 고치고 성공한다. 사용자는 저장됐다고 믿는다.
  const { data, error } = await supabase
    .from("profile")
    .upsert(
      {
        // 클라이언트가 보낸 user_id를 쓰지 않는다. 검증된 세션의 것만 쓴다.
        user_id: user.id,
        nickname: input.nickname,
        image_path: nextPath,
      },
      { onConflict: "user_id" },
    )
    .select("nickname, image_path")
    .single();

  if (error || !data) {
    console.error("[profile] 저장 실패", error);
    throw new Error("프로필을 저장하지 못했습니다.");
  }

  await removeOrphanImage(previousPath, data.image_path);

  const { count, error: countError } = await supabase
    .from("place")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (countError) {
    console.error("[profile] 등록 수 조회 실패", countError);
  }

  return toDto(data, user, count ?? 0);
}

/**
 * 사진을 Storage에 올리고 경로를 돌려준다.
 *
 * 경로는 `{user_id}/{uuid v4}.{확장자}`다. 첫 칸이 소유자인 이유는 버킷 정책이
 * `(storage.foldername(name))[1] = auth.uid()`로 판별하기 때문이다. 남의 폴더에
 * 쓰려는 요청은 여기까지 오더라도 Storage가 거절한다.
 *
 * 파일명을 uuid로 새로 짓는 이유: 원본 이름을 쓰면 공백·한글·`../`가 그대로
 * 경로가 되고, 같은 이름을 다시 올리면 이전 사진이 덮인다.
 */
async function uploadProfileImage(userId: string, file: File): Promise<string> {
  const supabase = await createClient();

  if (!isAllowedMimeType(file.type)) {
    // 라우트에서 이미 걸렀어야 한다. 여기까지 왔다면 호출자 쪽 실수다.
    throw new Error("지원하지 않는 이미지 형식입니다.");
  }

  const path = `${userId}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[file.type]}`;

  const { error } = await supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      // uuid라 부딪힐 일이 없다. upsert를 켜면 충돌이 조용히 덮어쓰기가 된다.
      upsert: false,
    });

  if (error) {
    console.error("[profile] 이미지 업로드 실패", error);
    throw new Error("이미지를 올리지 못했습니다.");
  }

  return path;
}

function isAllowedMimeType(
  mimeType: string,
): mimeType is (typeof PROFILE_IMAGE_MIME_TYPES)[number] {
  return (PROFILE_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * 더 이상 참조되지 않는 예전 사진을 지운다.
 *
 * 실패해도 던지지 않는다. 프로필은 이미 저장됐고, 사용자 입장에서 할 일은 끝났다.
 * 남은 파일은 로그로 남기고 넘어가는 편이 성공한 저장을 실패로 되돌리는 것보다 낫다.
 */
async function removeOrphanImage(
  previousPath: string | null,
  nextPath: string | null,
): Promise<void> {
  if (!previousPath || previousPath === nextPath) return;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .remove([previousPath]);

  if (error) {
    console.error("[profile] 이전 이미지 삭제 실패", previousPath, error);
  }
}

function toDto(row: ProfileRow, user: AuthUser, places: number): MyProfileDto {
  return {
    userId: user.id,
    nickname: row.nickname,
    handle: user.email ?? "",
    avatarUrl: resolveAvatarUrl(row.image_path, user.avatarUrl),
    hasCustomImage: row.image_path !== null,
    stats: {
      places,
      // 저장·후기 테이블이 아직 없다. 0으로 두고, 스키마가 생기면 여기만 바꾼다.
      saves: 0,
      reviews: 0,
    },
  };
}

/**
 * Storage 경로가 있으면 그걸 공개 URL로, 없으면 소셜 아바타로.
 *
 * `image_path`에는 Storage 객체 경로만 들어간다. Google 아바타 URL을 같은
 * 칸에 넣으면 한 컬럼이 두 가지 의미를 갖게 되므로 분리해서 다룬다.
 */
function resolveAvatarUrl(
  imagePath: string | null,
  socialAvatarUrl: string | null,
): string | null {
  if (imagePath) {
    return publicStorageUrl(PROFILE_IMAGE_BUCKET, imagePath);
  }
  return socialAvatarUrl;
}

/** 트리거 이전에 만들어진 계정을 위한 보정. 이미 있으면 아무 일도 안 한다. */
async function backfillProfile(user: AuthUser): Promise<ProfileRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profile")
    .upsert({ user_id: user.id, nickname: user.name }, { onConflict: "user_id" })
    .select("nickname, image_path")
    .single();

  if (error || !data) {
    console.error("[profile] 생성 실패", error);
    // 프로필이 없다고 마이페이지를 못 열 이유는 없다. 계정 이름으로 대체한다.
    return { nickname: user.name, image_path: null };
  }

  return data;
}
