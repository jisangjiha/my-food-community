import "server-only";

import type { LocalSearchResult } from "./dto";
import { naverSearchCredentials } from "./env";
import { KOREA_BOUNDS, stripHtml, toDegrees } from "./parse";

const ENDPOINT = "https://naverapihub.apigw.ntruss.com/search/v1/local";

/** API 상한. 더 큰 값을 보내면 SE02로 거절당한다. 기본값이 1이라 생략하면 안 된다. */
const DISPLAY = 5;

/** 응답 재사용 시간(초). 하루 25,000회 한도를 아끼기 위한 것. */
const REVALIDATE_SECONDS = 3600;

/** 네이버가 돌려주는 항목 중 우리가 쓰는 것만. 나머지는 무시한다. */
interface NaverLocalItem {
  title?: string;
  address?: string;
  roadAddress?: string;
  mapx?: string;
  mapy?: string;
}

interface NaverLocalResponse {
  items?: NaverLocalItem[];
}

/**
 * 네이버 지역검색. 실패하면 던진다 — 부르는 화면이 잡아서 상태를 고른다.
 *
 * 네이버 에러 코드(SE01~SE99)로 분기하지 않는다. 사용자가 할 수 있는 일이
 * "다시 시도" 하나뿐이라 갈라 봐야 문구만 늘어난다. 원인은 로그에 남긴다.
 */
export async function searchLocalPlaces(
  query: string,
): Promise<LocalSearchResult[]> {
  const needle = query.trim();
  if (needle === "") return [];

  const { clientId, clientSecret } = naverSearchCredentials();
  const url = `${ENDPOINT}?query=${encodeURIComponent(needle)}&display=${DISPLAY}`;

  const response = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `네이버 지역검색 실패 (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as NaverLocalResponse;

  return (payload.items ?? []).map(toLocalSearchResult);
}

function toLocalSearchResult(item: NaverLocalItem): LocalSearchResult {
  const address = item.address?.trim() ?? "";
  const roadAddress = item.roadAddress?.trim() ?? "";

  return {
    name: stripHtml(item.title ?? ""),
    // 지번이 비어 오는 항목이 있다. 그때는 도로명이라도 보여 준다.
    address: address !== "" ? address : roadAddress,
    roadAddress,
    lat: toDegrees(item.mapy, KOREA_BOUNDS.minLat, KOREA_BOUNDS.maxLat),
    lng: toDegrees(item.mapx, KOREA_BOUNDS.minLng, KOREA_BOUNDS.maxLng),
  };
}
