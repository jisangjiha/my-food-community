import { Icon } from "../foundation/Icon";

export interface MapPreviewProps {
  /** 핀 옆에 적히는 주소. */
  address: string;
  /**
   * `empty`는 주소가 아직 없는 글이다. 테두리가 생기고 글자가 흐려진다 —
   * 값이 있는 척하지 않기 위한 상태다.
   */
  state?: "filled" | "empty";
  className?: string;
}

/**
 * 주소 카드 — design.pen `02b Detail Page - Map`의 `Address Map Preview`.
 *
 * 예전 시안에서는 이 카드가 도식 지도까지 품고 있었지만, 새 시안은 지도를 위로
 * 빼내고("위치" + `Naver Mini Map`) 여기는 주소 한 줄만 남겼다. 지도 면은
 * `MapCanvas`가 맡는다.
 *
 * 아이콘: 아이콘 세트에 map-pin이 없어 시안이 `search` 글리프를 핀으로 쓴다.
 * 화면이 시안과 같아 보이도록 그대로 뒀다.
 */
export function MapPreview({
  address,
  state = "filled",
  className,
}: MapPreviewProps) {
  const empty = state === "empty";

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl bg-background-brand-subtle p-3 ${empty ? "border border-border-default" : ""} ${className ?? ""}`}
    >
      <span
        className={empty ? "text-text-subtle" : "text-text-brand"}
        aria-hidden
      >
        <Icon name="search" size={20} />
      </span>
      <p
        className={`type-label-md min-w-0 flex-1 ${empty ? "text-text-muted" : "text-text-default"}`}
      >
        {address}
      </p>
    </div>
  );
}
