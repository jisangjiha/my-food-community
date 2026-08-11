import type { ReactNode } from "react";

export interface CardProps {
  /** Optional media area above the body. 150px tall in the design. */
  image?: ReactNode;
  title?: ReactNode;
  /** Small line under the title, e.g. "항동 · 주차 가능 · 4.8". */
  meta?: ReactNode;
  description?: ReactNode;
  /** Replaces the title/meta/description body entirely. */
  children?: ReactNode;
  className?: string;
}

/** Card — design.pen `Card`. Width and height are auto; the caller sizes it. */
export function Card({
  image,
  title,
  meta,
  description,
  children,
  className,
}: CardProps) {
  return (
    <div
      className={`flex flex-col overflow-hidden border border-border-default bg-background-surface ${className ?? ""}`}
      style={{ borderRadius: 16 }}
    >
      {image && (
        <div className="w-full shrink-0" style={{ height: 150 }}>
          {image}
        </div>
      )}
      <div className="flex flex-col gap-1.5 p-3.5">
        {children ?? (
          <>
            {title && (
              <h3 className="type-heading-sm text-text-default">{title}</h3>
            )}
            {meta && <p className="type-label-md text-text-muted">{meta}</p>}
            {description && (
              <p className="type-body-md text-text-default">{description}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
