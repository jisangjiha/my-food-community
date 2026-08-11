/**
 * 맛집 DTO — BFF가 클라이언트로 내려보내는 유일한 모양.
 *
 * `place` 테이블의 Row 타입이 아니다. UI가 DB 컬럼명(`user_id`, `image_path`)과
 * snake_case에 묶이면 컬럼 이름 하나 바꿀 때 화면이 깨진다. 경계는 여기다.
 *
 * 이 파일은 서버 전용이 아니다. 클라이언트 컴포넌트가 타입과 상수만 import 해도 된다.
 * 폼이 서버와 같은 제한으로 미리 걸러 주려면 아래 상수가 필요하다.
 */

/** 제목 길이 상한. */
export const PLACE_TITLE_MAX_LENGTH = 100;

/** 내용 길이. 최소 10자는 요구사항이고, 상한은 본문 필드의 현실적인 한계다. */
export const PLACE_CONTENT_MIN_LENGTH = 10;
export const PLACE_CONTENT_MAX_LENGTH = 2000;

/** 사진은 최소 한 장. 없는 글은 목록에서 보여 줄 것이 없다. */
export const PLACE_IMAGE_MIN_COUNT = 1;
export const PLACE_IMAGE_MAX_COUNT = 5;
export const PLACE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const PLACE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** 장소명 길이 상한. 네이버 지역검색 상호명 기준으로 넉넉히 잡았다. */
export const PLACE_NAME_MAX_LENGTH = 100;

/** 지번주소 길이 상한. 행정구역 + 번지라 길어야 이 정도다. */
export const PLACE_ADDRESS_MAX_LENGTH = 200;

/**
 * 지도 정보가 없는 글의 주소 자리에 보여 줄 문구.
 *
 * `place.address`의 DB 기본값도 같은 문구다. 지도 정보가 필수가 되기 전에 들어온
 * 행이 목록에서 빈칸으로 보이지 않게 하려는 것이고, 새 글은 이 값을 쓰지 않는다.
 */
export const PLACE_PENDING_ADDRESS = "등록 대기중";

/**
 * 사진 한 장.
 *
 * `url`은 화면이 바로 쓰는 값이고, `path`는 수정 폼이 "이 사진은 그대로 둔다"고
 * 말할 때 되돌려 보내는 손잡이다. URL은 호스트가 바뀌면 달라지므로 식별자로
 * 쓸 수 없다.
 */
export interface PlaceImageDto {
  /** Storage 객체 경로(`{user_id}/{uuid}.jpg`). 수정 요청에 그대로 실어 보낸다. */
  path: string;
  /** 바로 <img src>에 넣을 수 있는 공개 URL. */
  url: string;
}

/**
 * 지도 정보 한 벌.
 *
 * 네 값을 따로 두지 않고 묶는 이유: 지도 정보는 필수라서 모두 있거나 모두
 * 없거나다. 흩어 두면 `name`은 있는데 `lat`은 없는 조합을 타입이 허용하고,
 * 화면마다 "네 개가 다 찼나"를 다시 검사하게 된다. 한 번 빠뜨리면 지도가
 * `undefined` 좌표로 아무 데나 가리킨다.
 */
export interface PlaceLocation {
  /** 장소명. 네이버 지역검색에서 고른 상호다. 글 제목(`title`)과 다르다. */
  name: string;
  /** 지번 주소. */
  address: string;
  /** WGS84. */
  lat: number;
  lng: number;
}

export interface PlaceDto {
  id: string;
  title: string;
  content: string;
  /** 지도 정보. 네 값이 모두 있어야 채워진다. 없는 레거시 행은 null. */
  location: PlaceLocation | null;
  /** ISO 8601. 포맷팅은 화면에서 한다. */
  createdAt: string;
  images: PlaceImageDto[];
  author: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  } | null;
  /** 현재 로그인한 사용자가 쓴 글인지. 비로그인이면 false. */
  isMine: boolean;
}

/** 목록 응답. 나중에 커서/총계가 붙어도 클라이언트 코드가 안 깨지도록 감싼다. */
export interface PlaceListDto {
  items: PlaceDto[];
}

/**
 * 등록 폼이 보내는 값.
 *
 * 파일을 직접 받는다. 클라이언트가 Storage에 먼저 올리고 경로만 보내는 방식은
 * 업로드 권한을 브라우저로 내보내는 것이라 CLAUDE.md의 BFF 규칙과 어긋난다.
 * 지도 정보는 필수다 — 없으면 입력 계층이 400으로 끊는다.
 */
export interface CreatePlaceInput {
  title: string;
  content: string;
  images: File[];
  location: PlaceLocation;
}

/**
 * 수정 폼이 보내는 값. "바뀐 것"이 아니라 "최종 상태"다.
 *
 * 이미지에 add/remove 명령을 주고받으면 클라이언트와 서버가 서로 다른 순서를
 * 가정하는 순간 어긋난다. 남길 사진(`keepImagePaths`)과 새로 올릴 사진(`images`)만
 * 받고, 목록에 없는 사진은 지운다. 판단이 서버 한쪽에서만 일어난다.
 *
 * 지도 정보도 마찬가지다. 수정 폼이 기존 값을 미리 채워 두고, 서버는 매번
 * 완전한 세트를 받는다.
 */
export interface UpdatePlaceInput {
  title: string;
  content: string;
  /** 그대로 둘 기존 사진의 Storage 경로. */
  keepImagePaths: string[];
  /** 이번에 새로 올리는 파일. */
  images: File[];
  location: PlaceLocation;
}
