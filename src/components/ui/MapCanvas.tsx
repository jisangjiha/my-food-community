/**
 * 지도 면 — design.pen `04 Place Register - Location`의 `Map`과
 * `02b Detail Page - Map`의 `Naver Mini Map`.
 *
 * 시안은 네이버 지도 타일을 캡처해 넣었지만, 이 프로젝트에는 아직 지도 API가
 * 없다. 특정 동네의 타일 이미지를 모든 글에 깔면 화면이 "이 좌표를 안다"고
 * 거짓말을 하게 되므로, `MapPreview`가 하던 것과 같은 방식으로 도식을 그린다.
 * 지도 API가 붙으면 이 컴포넌트 안쪽만 타일로 바꾸면 된다 — 크기·라운드·핀은
 * 시안 값 그대로다.
 */

export type MapCanvasSize = "sm" | "lg";

/**
 * 시안에서 잰 값. sm = 상세 미니맵, lg = 장소 등록 지도.
 *
 * 높이가 인라인 `style`이 아니라 클래스인 이유: 인라인 스타일은 어떤 클래스보다도
 * 세다. `style`로 150을 박아 두면 호출부가 넘긴 `md:h-[240px]`이 조용히 무시된다.
 */
export const MAP_CANVAS_SIZES = {
  sm: { height: "h-[150px]", pin: 28, dot: 9 },
  lg: { height: "h-[440px]", pin: 30, dot: 10 },
} satisfies Record<MapCanvasSize, { height: string; pin: number; dot: number }>;

export interface MapCanvasProps {
  /** 핀이 가리키는 곳. 대체 텍스트에 들어간다. */
  label: string;
  size?: MapCanvasSize;
  /**
   * 높이를 반응형으로 늘릴 때 쓴다. 인라인 `style`보다 클래스가 나중에 이기도록
   * 높이는 임의값 클래스(`md:h-[240px]`)로 넘긴다.
   */
  className?: string;
}

/** 도식 위에 얹는 길·블록. 위치는 지도처럼 보이기 위한 값이라 토큰이 아니다. */
const ROADS = [
  "inset-x-0 top-[30%] h-[11px]",
  "inset-x-0 top-[68%] h-[7px]",
  "inset-y-0 left-[23%] w-[9px]",
  "inset-y-0 left-[71%] w-[7px]",
];

const BLOCKS = [
  "left-[5%] top-[38%] h-[22%] w-[13%]",
  "left-[30%] top-[38%] h-[22%] w-[16%]",
  "left-[30%] top-[76%] h-[16%] w-[16%]",
  "left-[78%] top-[10%] h-[14%] w-[16%]",
  "left-[78%] top-[76%] h-[16%] w-[16%]",
];

/**
 * 지도 정중앙에 고정되는 핀. 도식(`MapCanvas`)과 실제 지도(`NaverMap`)가 같은
 * 핀을 쓴다. 시안이 고른 위치를 가운데 두고 지도를 움직이는 방식이라, 핀은
 * 좌표가 아니라 화면에 붙는다.
 *
 * `pointer-events-none`이 핵심이다. 진짜 지도 위에 얹히면 이 요소가 드래그를
 * 가로채 지도 한가운데가 죽은 영역이 된다.
 */
export function CenterPin({ size }: { size: MapCanvasSize }) {
  const spec = MAP_CANVAS_SIZES[size];

  return (
    <span
      className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-background-surface bg-background-brand"
      style={{
        width: spec.pin,
        height: spec.pin,
        boxShadow: "0 4px 12px #00000033",
      }}
      aria-hidden
    >
      <span
        className="rounded-full bg-background-surface"
        style={{ width: spec.dot, height: spec.dot }}
      />
    </span>
  );
}

export function MapCanvas({ label, size = "sm", className }: MapCanvasProps) {
  const spec = MAP_CANVAS_SIZES[size];

  return (
    <div
      role="img"
      aria-label={`${label} 위치 지도`}
      className={`relative w-full overflow-hidden rounded-2xl border border-border-default bg-background-subtle ${spec.height} ${className ?? ""}`}
    >
      {/* 대각선 큰길 하나. 격자만 있으면 지도보다 표처럼 보인다. */}
      <span
        className="absolute -left-[10%] top-[6%] h-[9px] w-[70%] origin-left rotate-[26deg] bg-background-surface"
        aria-hidden
      />
      {ROADS.map((road) => (
        <span
          key={road}
          className={`absolute bg-background-surface ${road}`}
          aria-hidden
        />
      ))}
      {BLOCKS.map((block) => (
        <span
          key={block}
          className={`absolute rounded-[4px] bg-neutral-200 ${block}`}
          aria-hidden
        />
      ))}

      {/* 핀은 언제나 정중앙 — 시안이 선택한 위치를 가운데 두고 지도를 움직인다. */}
      <CenterPin size={size} />
    </div>
  );
}
