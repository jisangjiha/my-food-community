import { SUPABASE_STORAGE_URL } from "./env";

/**
 * Storage 경로 ↔ 공개 URL 변환이 일어나는 유일한 곳.
 *
 * DB에는 경로만 담는다(`{user_id}/{uuid}.jpg`). 호스트가 바뀌면 저장된 URL을
 * 전부 고쳐야 하지만, 경로만 있으면 환경변수 하나로 끝난다.
 *
 * 변환은 서버(BFF)에서 한다. 클라이언트는 완성된 URL이 담긴 DTO만 받으므로
 * 버킷 이름이나 Storage 주소를 알 필요가 없다.
 */

export const PROFILE_IMAGE_BUCKET = "profile-image";
export const PLACE_IMAGE_BUCKET = "place_image";

export function publicStorageUrl(bucket: string, path: string): string {
  // 경로 구분자는 살리고 각 조각만 인코딩한다. 파일명이 uuid라 지금은 인코딩할
  // 문자가 없지만, 여기서 막아 두면 나중에 다른 이름 규칙이 와도 안전하다.
  const encoded = path.split("/").map(encodeURIComponent).join("/");

  return `${SUPABASE_STORAGE_URL.replace(/\/+$/, "")}/${bucket}/${encoded}`;
}
