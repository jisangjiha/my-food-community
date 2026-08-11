import { parseLatLng } from "@/lib/local-search/parse";

/**
 * 화면 사이를 쿼리로 오가는 장소.
 *
 * `PlaceLocation`(완성형)과 다른 점은 `name`이 비어 있을 수 있다는 것뿐이다.
 * 지도를 드래그해 위치를 잡으면 상호명이 없고, 그 이름은 등록 폼에서 받는다.
 * 이름까지 요구하면 그 사용자는 등록 화면에 들어가지도 못한다.
 */
export interface PlaceLocationDraft {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * 쿼리 → 장소. 주소와 좌표가 성해야 한다.
 *
 * 읽고 쓰는 곳이 세 군데(`/register`, `/register/place`, 폼의 "장소 다시 선택")라
 * 각자 적으면 파라미터 이름 하나가 어긋나는 날이 온다. 여기 하나만 둔다.
 */
export function readLocationDraftFromQuery(
  params: Record<string, string | string[] | undefined>,
): PlaceLocationDraft | null {
  const address = readParam(params.address);
  if (address === "") return null;

  const coords = parseLatLng(readParam(params.lat), readParam(params.lng));
  if (!coords) return null;

  return { name: readParam(params.name), address, ...coords };
}

export function locationDraftToQuery(draft: PlaceLocationDraft): string {
  return new URLSearchParams({
    name: draft.name,
    address: draft.address,
    lat: String(draft.lat),
    lng: String(draft.lng),
  }).toString();
}

/**
 * 돌아갈 내부 경로. 아니면 기본값.
 *
 * `returnTo`는 URL에 실려 오는 값이라 사용자가 무엇이든 넣을 수 있다. 그대로
 * 링크에 쓰면 오픈 리다이렉트다.
 *
 * `/`로 시작하는 것만으로는 부족하다 — `//evil.com`은 프로토콜 상대 URL이라
 * 브라우저가 외부 주소로 읽는다.
 */
export function readReturnTo(
  value: string | string[] | undefined,
  fallback: string,
): string {
  const path = readParam(value);
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

/** 같은 이름으로 두 번 실려 오면 배열이 된다. 그때는 없는 것으로 본다. */
function readParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}
