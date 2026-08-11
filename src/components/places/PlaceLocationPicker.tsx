"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ReverseGeocodeResult } from "../../lib/reverse-geocode/dto";
import { Card } from "../ui/Card";
import { NaverMap } from "../ui/NaverMap";
import { Skeleton } from "../ui/Skeleton";

/** 좌표는 유효한데 그 자리에 주소가 없다. 바다 한가운데가 그렇다. */
const ADDRESS_NOT_FOUND = "주소를 찾을 수 없어요";

/** 조회 자체가 실패했다. 지도를 조금 움직이면 다시 시도된다. */
const ADDRESS_ERROR = "주소를 불러오지 못했어요";

type AddressStatus = "idle" | "loading" | "error";

export interface PlaceLocationPickerProps {
  /** 검색으로 고른 상호명. 없으면 빈 문자열. */
  initialName: string;
  /**
   * 처음 보여 줄 지번주소.
   *
   * 검색으로 들어왔으면 `?address`, 아니면 서버가 미리 리버스 지오코딩한 값이다.
   * 최초 조회를 서버가 하므로 이 컴포넌트에는 마운트 시점 조회가 없다 — 화면이
   * 처음부터 주소를 갖고 그려지고, 왕복도 하나 줄어든다.
   */
  initialAddress: string;
  /** 지도의 처음 중심. */
  initialCenter: { lat: number; lng: number };
  /** NCP Client ID. null이면 지도가 도식으로 폴백한다. */
  clientId: string | null;
}

/**
 * 장소 선택 — 지도와 그 아래 카드를 함께 소유한다.
 *
 * 둘을 한 컴포넌트에 묶는 이유는 상태 주인을 하나로 두기 위해서다. 지도가
 * 가리키는 곳과 카드의 글자가 어긋날 수 없다.
 *
 * 지도에 `center`를 되먹이지 않는다. 사용자가 끌어 놓은 위치를 코드가 다시
 * 밀어 넣으면 지도와 싸우게 된다. `center`는 최초 위치일 뿐이다.
 */
export function PlaceLocationPicker({
  initialName,
  initialAddress,
  initialCenter,
  clientId,
}: PlaceLocationPickerProps) {
  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState(initialAddress);
  const [status, setStatus] = useState<AddressStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);

  /** 지도를 움직였을 때의 조회. 이 컴포넌트가 조회하는 유일한 경로다. */
  const fetchAddress = useCallback(
    async (center: { lat: number; lng: number }) => {
      // 이전 요청을 취소한다. 빠르게 여러 번 끌었을 때 늦게 도착한 옛 응답이
      // 최신 주소를 덮어쓰는 것을 막는다.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          `/api/geocode/reverse?lat=${center.lat}&lng=${center.lng}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`주소 조회 응답 ${response.status}`);
        }

        const result = (await response.json()) as ReverseGeocodeResult;
        setAddress(result.address ?? ADDRESS_NOT_FOUND);
        setStatus("idle");
      } catch (reason) {
        // 취소된 요청은 실패가 아니다. 더 새로운 요청이 이미 달리고 있으므로
        // 상태를 건드리면 그쪽의 결과를 지운다.
        if (controller.signal.aborted) return;

        console.error("[PlaceLocationPicker] 주소 조회 실패", reason);
        setStatus("error");
      }
    },
    [],
  );

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleCenterChange = useCallback(
    (center: { lat: number; lng: number }) => {
      // 지도를 움직였으면 고른 장소를 벗어난 것이다. 상호명을 그대로 두면
      // "예빈당 성수본점 / 서울특별시 광진구 …"처럼 화면이 거짓말을 한다.
      setName("");
      setStatus("loading");
      void fetchAddress(center);
    },
    [fetchAddress],
  );

  return (
    <>
      <NaverMap
        label={name !== "" ? name : "장소 선택"}
        clientId={clientId}
        center={initialCenter}
        onCenterChange={handleCenterChange}
      />

      <Card>
        <p className="type-label-md text-text-brand">선택한 위치</p>
        <h2 className="type-heading-md text-text-default">
          {name !== "" ? name : "장소를 선택해 주세요"}
        </h2>
        {status === "loading" ? (
          <Skeleton variant="text" width="60%" height={18} />
        ) : (
          <p className="type-body-lg text-text-muted">
            {status === "error" ? ADDRESS_ERROR : address}
          </p>
        )}
      </Card>
    </>
  );
}
