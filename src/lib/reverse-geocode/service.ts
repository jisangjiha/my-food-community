import "server-only";

import type { ReverseGeocodeResult } from "./dto";
import { naverGeocodeCredentials } from "./env";
import { formatJibunAddress, type NaverGeocodeResult } from "./format";

const ENDPOINT = "https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc";

/** 응답 재사용 시간(초). 좌표와 주소의 대응은 사실상 바뀌지 않는다. */
const REVALIDATE_SECONDS = 86400;

/** 요청은 성공했는데 그 좌표에 주소가 없다. 오류가 아니다. */
const NO_RESULTS = 3;

const OK = 0;

interface NaverReverseGeocodeResponse {
  status?: { code?: number; message?: string };
  results?: NaverGeocodeResult[];
}

/**
 * 좌표 → 지번주소. 실패하면 던진다 — Route Handler의 `withRoute`가 500으로 바꾼다.
 *
 * 도로명(`roadaddr`)은 요청하지 않는다. 화면이 지번 하나만 보여 준다.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  const { apiKeyId, apiKey } = naverGeocodeCredentials();

  // coords는 경도,위도(x,y) 순서다. 뒤집어도 API는 에러를 내지 않고 "결과 없음"이나
  // 엉뚱한 주소를 그럴듯하게 돌려준다. 조립은 이 줄 하나에서만 한다.
  const coords = `${lng},${lat}`;
  const url = `${ENDPOINT}?coords=${encodeURIComponent(coords)}&output=json&orders=addr`;

  const response = await fetch(url, {
    headers: {
      "x-ncp-apigw-api-key-id": apiKeyId,
      "x-ncp-apigw-api-key": apiKey,
    },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // 좌표를 함께 남긴다. 키는 헤더에 있으므로 URL에 비밀값이 없다. 어떤 좌표가
    // 거절당했는지 모르면 "호출 실패"라는 말만 남아 고칠 실마리가 없다.
    throw new Error(
      `네이버 리버스 지오코딩 실패 (${response.status}) coords=${coords}: ${body.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as NaverReverseGeocodeResponse;
  const code = payload.status?.code;

  if (code === NO_RESULTS) return { address: null };
  if (code !== OK) {
    throw new Error(
      `네이버 리버스 지오코딩 오류 (code ${String(code)}): ${payload.status?.message ?? ""}`,
    );
  }

  return { address: formatJibunAddress(payload.results?.[0]) };
}
