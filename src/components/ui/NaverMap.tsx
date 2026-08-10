"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { CenterPin, MAP_CANVAS_SIZES, MapCanvas } from "./MapCanvas";

/**
 * 서울시청. 선택한 장소에 좌표가 아직 없어 지도는 늘 여기서 시작한다.
 * 좌표가 생기면 이 상수 대신 장소의 좌표를 받도록 prop을 연다.
 */
export const SEOUL_CITY_HALL = { lat: 37.5666103, lng: 126.9783882 };

/** 건물이 구분되는 축척. */
export const DEFAULT_ZOOM = 16;

declare global {
  interface Window {
    /**
     * 네이버가 인증에 실패하면 직접 부르는 전역 훅. 도메인 미등록이나 키 오타는
     * 네트워크 에러를 내지 않으므로, 이것이 없으면 회색 사각형만 남는다.
     */
    navermap_authFailure?: () => void;
  }
}

export interface NaverMapProps {
  /** 폴백 도식의 대체 텍스트에 들어가는 장소 이름. */
  label: string;
  /** NCP Client ID. `null`이면 도식으로 폴백한다. */
  clientId: string | null;
  className?: string;
}

/**
 * 네이버 지도 — design.pen `04 Place Register - Location`의 `Map`.
 *
 * 핀은 `naver.maps.Marker`가 아니다. 마커는 좌표에 붙어 지도와 함께 움직이는데,
 * 여기 필요한 동작은 그 반대다. 핀은 화면 정중앙에 못 박히고 지도가 그 밑에서
 * 흐른다. 그래서 핀은 지도 위에 얹은 DOM 오버레이(`CenterPin`)다.
 *
 * 키가 없거나 스크립트 로드·인증이 실패하면 기존 `MapCanvas` 도식으로 되돌린다.
 * 지도는 등록 흐름의 한 조각이라, 지도가 죽었다고 화면 전체가 죽으면 안 된다.
 */
export function NaverMap({ label, clientId, className }: NaverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);

  const initMap = useCallback(() => {
    if (mapRef.current || !containerRef.current) return;
    if (typeof naver === "undefined" || !naver.maps) return;

    mapRef.current = new naver.maps.Map(containerRef.current, {
      center: new naver.maps.LatLng(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng),
      zoom: DEFAULT_ZOOM,
      // 지도는 움직여야 한다 — 핀이 고정이라 위치를 고르는 수단이 이것뿐이다.
      draggable: true,
      pinchZoom: true,
      scrollWheel: true,
      keyboardShortcuts: true,
      zoomControl: true,
      zoomControlOptions: { position: naver.maps.Position.RIGHT_BOTTOM },
      // 등록 화면에 필요 없는 컨트롤. 로고와 저작권 표기는 약관상 지울 수 없다.
      mapDataControl: false,
      scaleControl: false,
    });
  }, []);

  useEffect(() => {
    window.navermap_authFailure = () => {
      console.error(
        "[NaverMap] 네이버 지도 인증 실패. NAVER_MAP_CLIENT_ID 값과 NCP 콘솔의 Web 서비스 URL 등록을 확인하세요.",
      );
      setFailed(true);
    };

    // 스크립트가 이미 받아진 뒤 다시 마운트된 경우를 위해 여기서도 시도한다.
    // `onReady`가 먼저 불렸다면 `initMap`의 가드가 두 번째 생성을 막는다.
    initMap();

    return () => {
      delete window.navermap_authFailure;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [initMap]);

  if (clientId === null || failed) {
    return <MapCanvas label={label} size="lg" className={className} />;
  }

  return (
    // `role="img"`를 쓰지 않는다. 도식과 달리 이 지도는 줌 버튼 같은 포커스 가능한
    // 자식을 갖고, `img` 안의 자식은 보조기술이 무시한다.
    //
    // 대체 텍스트에 `label`을 넣지 않는 것도 의도다. 지도는 아직 고른 장소가
    // 아니라 서울시청을 보여 준다. 좌표가 붙기 전에 이름을 말하면 거짓말이 된다.
    <div
      role="region"
      aria-label="장소 선택 지도"
      className={`relative w-full overflow-hidden rounded-2xl border border-border-default bg-background-subtle ${MAP_CANVAS_SIZES.lg.height} ${className ?? ""}`}
    >
      <div ref={containerRef} className="absolute inset-0" />
      <CenterPin size="lg" />
      <Script
        id="naver-maps"
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`}
        strategy="afterInteractive"
        onReady={initMap}
        onError={() => {
          console.error("[NaverMap] 지도 스크립트를 불러오지 못했습니다.");
          setFailed(true);
        }}
      />
    </div>
  );
}
