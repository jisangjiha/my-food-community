import type { ReactNode } from "react";

const SCRIM = "#17131966";

export interface BottomSheetProps {
  title?: string;
  children?: ReactNode;
  /** Tapping the scrim dismisses without choosing anything. */
  onClose?: () => void;
  className?: string;
}

/** BottomSheet — design.pen `BottomSheet`. Full width, height follows content. */
export function BottomSheet({
  title,
  children,
  onClose,
  className,
}: BottomSheetProps) {
  return (
    <div
      className="flex flex-col justify-end"
      style={{ backgroundColor: SCRIM }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`flex w-full flex-col gap-3.5 bg-background-surface px-4 pt-2.5 pb-5 ${className ?? ""}`}
        style={{ borderRadius: "16px 16px 0 0" }}
      >
        <div className="flex justify-center pb-1" aria-hidden>
          <span
            className="rounded-sm bg-border-strong"
            style={{ width: 36, height: 4 }}
          />
        </div>
        {title && (
          <h2 className="type-heading-sm text-text-default">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}

export interface BottomSheetOptionProps {
  children: ReactNode;
  onClick?: () => void;
}

/** A 44px row inside a sheet. */
export function BottomSheetOption({
  children,
  onClick,
}: BottomSheetOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="type-body-lg flex w-full cursor-pointer items-center px-1 text-left text-text-default focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-brand"
      style={{ height: 44 }}
    >
      {children}
    </button>
  );
}
