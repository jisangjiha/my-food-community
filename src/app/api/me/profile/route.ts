import {
  jsonOk,
  optionalFile,
  readFormData,
  requireString,
  withRoute,
} from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import {
  NICKNAME_MAX_LENGTH,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MIME_TYPES,
  type MyProfileDto,
} from "@/lib/profile/dto";
import { getMyProfile, updateMyProfile } from "@/lib/profile/service";

/**
 * 내 프로필 조회/수정.
 *
 * 순서는 CLAUDE.md 규칙 그대로: 입력 검증 → 권한 확인 → 서비스 호출 →
 * DTO로 정형화. Supabase 클라이언트도 버킷 이름도 이 파일에 등장하지 않는다.
 *
 * 수정은 `multipart/form-data`로 받는다. 사진 파일과 닉네임이 한 요청에 같이
 * 오므로 JSON으로는 담을 수 없고, 나눠 보내면 사진만 올라가고 닉네임은 실패하는
 * 중간 상태가 생긴다.
 *
 * 필드:
 * - `nickname`   (필수) 1..20자
 * - `image`      (선택) 새 프로필 사진
 * - `removeImage`(선택) "true"면 올렸던 사진을 지우고 구글 계정 사진으로 되돌린다
 */

export const GET = withRoute(async () => {
  const user = await requireUser();

  return jsonOk<MyProfileDto>(await getMyProfile(user));
});

export const PATCH = withRoute(async (request: Request) => {
  const user = await requireUser();

  const form = await readFormData(request);
  const nickname = requireString(Object.fromEntries(form), "nickname", {
    max: NICKNAME_MAX_LENGTH,
    label: "닉네임",
  });
  const image = optionalFile(form, "image", {
    maxBytes: PROFILE_IMAGE_MAX_BYTES,
    mimeTypes: PROFILE_IMAGE_MIME_TYPES,
    label: "프로필 사진",
  });

  const profile = await updateMyProfile(user, {
    nickname,
    image: image ?? undefined,
    removeImage: form.get("removeImage") === "true",
  });

  return jsonOk<MyProfileDto>(profile);
});
