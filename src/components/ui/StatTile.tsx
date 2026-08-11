export interface StatTileProps {
  /** The number, e.g. "12". */
  value: string;
  /** What it counts, e.g. "등록". */
  label: string;
  className?: string;
}

/** One cell of 마이 페이지's counts row. Sized by its parent. */
export function StatTile({ value, label, className }: StatTileProps) {
  return (
    <div
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-[14px] bg-background-surface px-3 py-2.5 ${className ?? ""}`}
    >
      <span className="type-heading-md text-text-default">{value}</span>
      <span className="type-label-md text-text-muted">{label}</span>
    </div>
  );
}
