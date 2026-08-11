import { jsonOk, ValidationError, withRoute } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { parseLatLng } from "@/lib/local-search/parse";
import type { ReverseGeocodeResult } from "@/lib/reverse-geocode/dto";
import { reverseGeocode } from "@/lib/reverse-geocode/service";

/**
 * 좌표 → 지번주소.
 *
 * 지역검색과 달리 라우트가 필요하다. 호출을 일으키는 것이 사용자의 드래그라
 * 클라이언트가 부르고, 키는 서버에만 있어야 하기 때문이다.
 *
 * `requireUser()`로 막는 이유는 이것이 키가 걸린 외부 API로 나가는 통로이기
 * 때문이다. 열어 두면 익명 요청이 할당량을 태울 수 있다. `/register/place`가
 * 이미 로그인을 요구하므로 정상 사용자에게는 차이가 없다.
 *
 * 좌표 검증은 지역검색이 쓰는 `parseLatLng`를 그대로 쓴다. 한국 범위를 벗어난
 * 값을 그대로 네이버에 넘기면 할당량만 태우고 쓸모없는 답을 받는다.
 */
export const GET = withRoute(async (request: Request) => {
  await requireUser();

  const { searchParams } = new URL(request.url);
  const center = parseLatLng(searchParams.get("lat"), searchParams.get("lng"));
  if (!center) {
    throw new ValidationError("올바른 좌표(lat, lng)가 필요합니다.");
  }

  const result = await reverseGeocode(center.lat, center.lng);

  return jsonOk<ReverseGeocodeResult>(result);
});
