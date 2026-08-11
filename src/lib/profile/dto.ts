/**
 * 로그인한 사용자의 마이페이지 DTO.
 *
 * auth(계정)와 profile(앱 데이터)이 두 곳에 나뉘어 있다는 사실은 여기서 끝난다.
 * 화면은 합쳐진 하나의 모양만 본다.
 */
export interface MyProfileDto {
  userId: string;
  nickname: string;
  /** 프로필 줄에 보여줄 보조 텍스트. 지금은 이메일. */
  handle: string;
  /** Storage 업로드 이미지 → 없으면 소셜 아바타 → 없으면 null. */
  avatarUrl: string | null;
  /**
   * 위 `avatarUrl`이 직접 올린 사진인지.
   *
   * false면 구글 계정 사진이거나 비어 있다는 뜻이다. 수정 화면이 "기본 사진으로
   * 되돌리기"를 보여줄지 판단하는 데 쓴다. URL만 봐서는 구분할 수 없다.
   */
  hasCustomImage: boolean;
  stats: {
    /** 내가 등록한 맛집 수. */
    places: number;
    /** 저장/후기는 아직 테이블이 없다. 스키마가 생기면 채운다. */
    saves: number;
    reviews: number;
  };
}

/**
 * 프로필 수정 제약.
 *
 * 타입만 있는 모듈에 상수를 두는 이유: 이 값들은 서버의 검증과 화면의 안내
 * 문구·`accept` 속성이 동시에 봐야 한다. 양쪽에 따로 적으면 언젠가 어긋나고,
 * 그때 사용자는 "2MB까지"라고 쓰인 화면에서 2MB 파일을 거절당한다.
 *
 * 이 모듈에는 `server-only`가 없으므로 클라이언트 컴포넌트도 그대로 읽는다.
 */
export const NICKNAME_MAX_LENGTH = 20;
export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/**
 * 프로필 수정 입력.
 *
 * Route Handler가 폼을 검증해서 이 모양으로 바꾼 뒤 서비스에 넘긴다.
 * 서비스는 FormData나 Request를 알지 못한다.
 */
export interface UpdateProfileInput {
  nickname: string;
  /** 새로 올릴 사진. 바꾸지 않으면 undefined. */
  image?: File;
  /**
   * 올렸던 사진을 지우고 소셜 아바타로 되돌린다.
   * `image`가 함께 오면 새 사진이 이긴다.
   */
  removeImage?: boolean;
}

/** 클라이언트가 로그인 상태를 물어볼 때 받는 모양. */
export interface SessionDto {
  authenticated: boolean;
  user: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  } | null;
}
