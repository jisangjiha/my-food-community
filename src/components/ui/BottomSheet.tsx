"use client";

import { useEffect, type ReactNode } from "react";

const SCRIM = "#17131966";

export interface BottomSheetProps {
  title?: string;
  children?: ReactNode;
  /** Tapping the scrim dismisses without choosing anything. */
  onClose?: () => void;
  /**
   * 화면 전체를 덮는 오버레이로 띄운다. Esc로 닫히고 뒤 화면 스크롤이 잠긴다.
   * 끄면(기본) 흐름 안에서 그대로 렌더된다 — 스토리에서 쓰는 모양이다.
   */
  floating?: boolean;
  className?: string;
}

/** BottomSheet — design.pen `BottomSheet`. Full width, height follows content. */
export function BottomSheet({
  title,
  children,
  onClose,
  floating = false,
  className,
}: BottomSheetProps) {
  useEffect(() => {
    if (!floating) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);

    // 시트 뒤 화면이 같이 움직이면 어디를 만지는지 알 수 없다.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [floating, onClose]);

  return (
    <div
      className={
        floating
          ? // md부터는 아래에 붙는 시트가 아니라 가운데 다이얼로그로 올라온다.
            "fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-24"
          : "flex flex-col justify-end"
      }
      style={{ backgroundColor: SCRIM }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`flex w-full flex-col gap-3.5 rounded-t-2xl bg-background-surface px-4 pt-2.5 pb-5 ${
          floating ? "md:max-w-[480px] md:rounded-2xl" : ""
        } ${className ?? ""}`}
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
