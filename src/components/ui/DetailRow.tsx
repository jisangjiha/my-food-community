import type { ReactNode } from "react";

export interface DetailRowProps {
  label: string;
  /** 값의 색 유틸리티. 기본은 본문색. */
  tone?: string;
  children: ReactNode;
}

/**
 * 라벨-값 한 줄 — design.pen의 모임 정보 카드 · 결제 완료 카드 · 취소 모달이 모두
 * 같은 줄을 쓴다. 라벨은 왼쪽 12px 흐린 글씨, 값은 오른쪽 14px 강조 글씨다.
 *
 * 세 화면이 각자 flex 줄을 들고 있으면 한 곳만 간격이 바뀌는 날이 온다.
 */
export function DetailRow({
  label,
  tone = "text-text-default",
  children,
}: DetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="type-label-md shrink-0 text-text-muted">{label}</span>
      <span className={`type-label-lg text-right ${tone}`}>{children}</span>
    </div>
  );
}
