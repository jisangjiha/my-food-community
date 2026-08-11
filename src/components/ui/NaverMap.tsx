"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_ZOOM, SEOUL_CITY_HALL } from "../../lib/maps/constants";
import {
  CenterPin,
  MAP_CANVAS_SIZES,
  MapCanvas,
  type MapCanvasSize,
} from "./MapCanvas";

// 상수는 `src/lib/maps/constants.ts`에 있다. 이 파일은 `"use client"`라 서버
// 컴포넌트가 여기서 값을 가져가면 클라이언트 참조가 되어 서버에서 `undefined`가
// 된다. 그 사연은 그쪽 파일 주석에 있다.

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
  /**
   * 지도 중심. 생략하면 서울시청.
   *
   * 고른 장소의 좌표가 없을 때(이름만 직접 입력, 좌표 파싱 실패)를 위해
   * 선택값이다.
   */
  center?: { lat: number; lng: number };
  /**
   * `picker`는 위치를 고르는 지도다 — 중앙에 고정된 핀 아래로 지도가 흐르고,
   * 드래그·줌으로 위치를 옮긴다.
   *
   * `static`은 이미 정해진 위치를 보여 주는 지도다. 좌표에 마커를 박고 조작을
   * 모두 끈다. 상세 화면의 미니지도가 이것이다.
   */
  variant?: "picker" | "static";
  /** 높이와 폴백 도식의 규격. `sm` 150px, `lg` 440px. */
  size?: MapCanvasSize;
  /**
   * 지도가 멈출 때(`idle`) 바뀐 중심 좌표. 사용자가 움직였을 때만 불린다.
   *
   * 지도 생성 시점에도 `idle`이 한 번 발생하는데, 그때는 좌표가 초기값과 같아
   * 걸러진다. 이게 없으면 화면이 열리자마자 "위치를 옮겼다"고 오해한다.
   *
   * `variant="static"`에서는 지도가 움직이지 않으므로 리스너를 달지 않는다.
   */
  onCenterChange?: (center: { lat: number; lng: number }) => void;
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
export function NaverMap({
  label,
  clientId,
  center = SEOUL_CITY_HALL,
  variant = "picker",
  size = "lg",
  onCenterChange,
  className,
}: NaverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const markerRef = useRef<naver.maps.Marker | null>(null);
  const listenerRef = useRef<naver.maps.MapEventListener | null>(null);
  const zoomListenerRef = useRef<naver.maps.MapEventListener | null>(null);
  const [failed, setFailed] = useState(false);

  /**
   * 콜백을 ref로 들고 있는 이유: `initMap`의 의존성에 넣으면 부모가 다시 그릴
   * 때마다 함수 정체성이 바뀌어 지도가 통째로 다시 만들어진다. 부모에게
   * `useCallback`을 강요하는 대신 여기서 흡수한다.
   *
   * 렌더 중이 아니라 effect에서 갱신한다. `useRef(onCenterChange)`가 첫 렌더의
   * 값을 이미 담고 있으므로 이후 갱신만 effect가 맡으면 빈틈이 없다.
   */
  const onCenterChangeRef = useRef(onCenterChange);
  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  /** 마지막으로 보고한 좌표. 초기값이 초기 중심이라 생성 시점 `idle`이 걸러진다. */
  const lastReportedRef = useRef({ lat: center.lat, lng: center.lng });

  // 객체를 그대로 의존성에 넣으면 매 렌더 새 참조라 지도가 끝없이 다시 만들어진다.
  const { lat, lng } = center;

  const initMap = useCallback(() => {
    if (mapRef.current || !containerRef.current) return;
    if (typeof naver === "undefined" || !naver.maps) return;

    const interactive = variant === "picker";
    const position = new naver.maps.LatLng(lat, lng);

    // 지역 변수에 먼저 담는다. `mapRef.current`는 `Map | null`이라 아래 마커
    // 옵션에 그대로 넘기면 좁히기에 기대야 한다.
    const map = new naver.maps.Map(containerRef.current, {
      center: position,
      zoom: DEFAULT_ZOOM,
      // picker에서 지도는 움직여야 한다 — 핀이 고정이라 위치를 고르는 수단이
      // 이것뿐이다. static은 읽기 전용이라 전부 끈다.
      draggable: interactive,
      pinchZoom: interactive,
      scrollWheel: interactive,
      keyboardShortcuts: interactive,
      zoomControl: interactive,
      zoomControlOptions: { position: naver.maps.Position.RIGHT_BOTTOM },
      // 등록 화면에 필요 없는 컨트롤. 로고와 저작권 표기는 약관상 지울 수 없다.
      mapDataControl: false,
      scaleControl: false,
    });
    mapRef.current = map;

    // 마커는 static에만 있다. picker의 핀이 마커가 아닌 이유는 위 주석에 있다 —
    // 마커는 좌표에 붙어 지도와 함께 움직이는데, 고르는 화면에 필요한 동작은
    // 그 반대다.
    if (!interactive) {
      markerRef.current = new naver.maps.Marker({ position, map });
      return;
    }

    // 지도를 새로 만들면 기준점도 새 중심이다. 이걸 안 맞추면 부모가 `center`를
    // 바꿔 지도가 다시 만들어졌을 때, 첫 `idle`이 "사용자가 움직였다"로 오인된다.
    lastReportedRef.current = { lat, lng };

    // 줌은 위치를 바꾸려는 조작이 아니라 확인하려는 조작이다. 그런데 휠·핀치
    // 줌은 커서 쪽으로 확대하느라 중심을 옮긴다. 그대로 두면 고른 가게가 풀리고
    // 주소가 옆 번지로 바뀌어, 정작 "이 건물이 맞나" 확인하려고 확대한 사용자가
    // 확인할 대상을 잃는다. 줌으로 밀린 중심은 되돌린다.
    zoomListenerRef.current = naver.maps.Event.addListener(
      map,
      "zoom_changed",
      () => {
        const pinned = lastReportedRef.current;
        map.setCenter(new naver.maps.LatLng(pinned.lat, pinned.lng));
      },
    );

    listenerRef.current = naver.maps.Event.addListener(map, "idle", () => {
      const nextCenter = map.getCenter();
      // `getCenter()`는 `Point | LatLng` 유니온이다. `Point`의 x/y로도
      // 컴파일되지만 어느 쪽이 위도인지가 코드에 드러나지 않는다 — 뒤집혀도
      // 아무 불평 없이 엉뚱한 곳을 가리키는 종류의 실수다. 이름이 붙은
      // 접근자를 쓰기 위해 좁힌다.
      if (!(nextCenter instanceof naver.maps.LatLng)) return;

      const next = { lat: nextCenter.lat(), lng: nextCenter.lng() };
      const last = lastReportedRef.current;
      if (next.lat === last.lat && next.lng === last.lng) return;

      lastReportedRef.current = next;
      onCenterChangeRef.current?.(next);
    });
    // 좌표가 바뀌면 아래 effect의 정리가 지도를 destroy 하고 새 좌표로 다시
    // 만든다. 검색 → 등록은 라우트 전환이라 컴포넌트가 어차피 새로 마운트되므로
    // 이 경로는 사실상 거의 타지 않지만, 타도 맞게 동작한다.
  }, [lat, lng, variant]);

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
      if (listenerRef.current) {
        naver.maps.Event.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
      if (zoomListenerRef.current) {
        naver.maps.Event.removeListener(zoomListenerRef.current);
        zoomListenerRef.current = null;
      }
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [initMap]);

  if (clientId === null || failed) {
    return <MapCanvas label={label} size={size} className={className} />;
  }

  return (
    // `role="img"`를 쓰지 않는다. 도식과 달리 이 지도는 줌 버튼 같은 포커스 가능한
    // 자식을 갖고, `img` 안의 자식은 보조기술이 무시한다.
    //
    // 대체 텍스트에 `label`을 넣지 않는 것도 의도다. 지도는 아직 고른 장소가
    // 아니라 서울시청을 보여 준다. 좌표가 붙기 전에 이름을 말하면 거짓말이 된다.
    //
    // `static`은 반대다 — 좌표가 이미 정해져 있으므로 그곳의 이름을 말한다.
    <div
      role="region"
      aria-label={variant === "picker" ? "장소 선택 지도" : `${label} 위치 지도`}
      className={`relative w-full overflow-hidden rounded-2xl border border-border-default bg-background-subtle ${MAP_CANVAS_SIZES[size].height} ${className ?? ""}`}
    >
      {/*
        크기를 위치(`absolute inset-0`)가 아니라 높이·폭으로 준다. 네이버 지도는
        생성 시 이 요소에 `position: relative`를 인라인으로 덮어쓰는데, 인라인은
        어떤 클래스보다도 세다(`MapCanvas`의 높이 주석과 같은 함정이다). 그러면
        `inset-0`의 top/bottom은 늘리는 힘을 잃고, 네이버가 만든 자식은 전부
        absolute라 콘텐츠 높이가 0이 된다 — 타일은 받아 놓고 그릴 면적이 없어진다.
      */}
      <div ref={containerRef} className="h-full w-full" />
      {variant === "picker" && <CenterPin size={size} />}
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
