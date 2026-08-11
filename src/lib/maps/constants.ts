/**
 * 지도 상수. 서버와 클라이언트가 함께 쓴다.
 *
 * `NaverMap.tsx`가 아니라 여기 있는 이유: 그 파일은 `"use client"`다. 서버
 * 컴포넌트가 클라이언트 모듈에서 값을 import 하면 실제 객체가 아니라 클라이언트
 * 참조가 오고, 서버에서 속성을 읽으면 `undefined`가 된다. 그 값으로 외부 API를
 * 부르면 `coords=undefined,undefined`처럼 조용히 틀린 요청이 나간다.
 */

/** 서울시청. 고른 좌표가 없을 때의 기본 중심. */
export const SEOUL_CITY_HALL = { lat: 37.5666103, lng: 126.9783882 };

/** 건물이 구분되는 축척. */
export const DEFAULT_ZOOM = 16;
