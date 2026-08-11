import {
  readFiles,
  readFormData,
  requireString,
  ValidationError,
} from "@/lib/api/http";
import { parseLatLng } from "@/lib/local-search/parse";
import {
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_CONTENT_MAX_LENGTH,
  PLACE_CONTENT_MIN_LENGTH,
  PLACE_IMAGE_MAX_BYTES,
  PLACE_IMAGE_MAX_COUNT,
  PLACE_IMAGE_MIME_TYPES,
  PLACE_IMAGE_MIN_COUNT,
  PLACE_NAME_MAX_LENGTH,
  PLACE_TITLE_MAX_LENGTH,
  type CreatePlaceInput,
  type PlaceLocation,
  type UpdatePlaceInput,
} from "./dto";

/**
 * 요청 본문 → 입력 DTO.
 *
 * 라우트가 아니라 여기에 두는 이유: 등록과 수정이 같은 규칙(제목 필수, 내용
 * 10자 이상, 사진 1장 이상)을 쓴다. 라우트마다 검증을 적으면 한쪽만 고치는
 * 날이 온다. 서비스가 아니라 여기인 이유: 서비스는 `File`과 문자열만 알면
 * 되고, `FormData`가 어떻게 생겼는지는 몰라도 된다.
 *
 * 파일이 섞이므로 본문은 JSON이 아니라 multipart/form-data다.
 */

const IMAGE_FIELD_OPTIONS = {
  maxBytes: PLACE_IMAGE_MAX_BYTES,
  mimeTypes: PLACE_IMAGE_MIME_TYPES,
  label: "사진",
} as const;

export async function readCreatePlaceInput(
  request: Request,
): Promise<CreatePlaceInput> {
  const form = await readFormData(request);
  const { title, content } = readTextFields(form);
  const location = readLocation(form);
  const images = readFiles(form, "images", IMAGE_FIELD_OPTIONS);

  assertImageCount(images.length);

  return { title, content, location, images };
}

export async function readUpdatePlaceInput(
  request: Request,
): Promise<UpdatePlaceInput> {
  const form = await readFormData(request);
  const { title, content } = readTextFields(form);
  const location = readLocation(form);
  const images = readFiles(form, "images", IMAGE_FIELD_OPTIONS);
  const keepImagePaths = readKeepImagePaths(form);

  // 남긴 사진과 새로 올린 사진을 합친 것이 수정 후의 최종 개수다.
  assertImageCount(keepImagePaths.length + images.length);

  return { title, content, location, keepImagePaths, images };
}

/** 등록과 수정이 공유하는 본문 규칙. */
function readTextFields(form: FormData): { title: string; content: string } {
  // requireString은 객체에서 읽는다. FormData 값을 그대로 넘겨 규칙을 재사용한다.
  const fields = { title: form.get("title"), content: form.get("content") };

  return {
    title: requireString(fields, "title", {
      max: PLACE_TITLE_MAX_LENGTH,
      label: "제목",
    }),
    content: requireString(fields, "content", {
      min: PLACE_CONTENT_MIN_LENGTH,
      max: PLACE_CONTENT_MAX_LENGTH,
      label: "내용",
    }),
  };
}

/**
 * 지도 정보 한 벌. 하나라도 없으면 던진다.
 *
 * 등록과 수정이 같은 함수를 쓴다. 라우트마다 적으면 한쪽만 느슨해지는 날이 온다.
 *
 * 좌표는 `parseLatLng`로 검증한다 — 지역검색 결과와 같은 잣대다. 폼이 보낸
 * 값이라 믿을 수 없고, `0,0`이 들어오면 지도가 기니 만 앞바다를 가리킨다.
 */
function readLocation(form: FormData): PlaceLocation {
  const fields = { name: form.get("name"), address: form.get("address") };

  const name = requireString(fields, "name", {
    max: PLACE_NAME_MAX_LENGTH,
    label: "장소명",
  });
  const address = requireString(fields, "address", {
    max: PLACE_ADDRESS_MAX_LENGTH,
    label: "주소",
  });

  const coords = parseLatLng(form.get("lat"), form.get("lng"));
  if (!coords) {
    throw new ValidationError(
      "장소의 좌표가 올바르지 않습니다. 지도에서 위치를 다시 선택해 주세요.",
    );
  }

  return { name, address, lat: coords.lat, lng: coords.lng };
}

/**
 * 그대로 둘 기존 사진 경로. 없으면 빈 배열.
 *
 * 같은 이름으로 여러 번 실려 온다(`keepImagePaths=a&keepImagePaths=b`).
 * 중복은 여기서 걷어낸다. 같은 경로가 두 번 오면 place_image에 같은 행이
 * 두 번 생기고, 상세 화면에 같은 사진이 두 장 보인다.
 *
 * 이 경로가 정말 이 글의 것인지는 서비스가 확인한다. 여기서는 형식만 본다.
 */
function readKeepImagePaths(form: FormData): string[] {
  const values = form.getAll("keepImagePaths");
  const paths = values.map((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      throw new ValidationError("남길 사진 정보가 올바르지 않습니다.");
    }
    return value.trim();
  });

  return [...new Set(paths)];
}

function assertImageCount(count: number): void {
  if (count < PLACE_IMAGE_MIN_COUNT) {
    throw new ValidationError(
      `사진을 ${PLACE_IMAGE_MIN_COUNT}장 이상 등록해 주세요.`,
    );
  }
  if (count > PLACE_IMAGE_MAX_COUNT) {
    throw new ValidationError(
      `사진은 ${PLACE_IMAGE_MAX_COUNT}장까지 등록할 수 있습니다.`,
    );
  }
}
