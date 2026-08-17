"use client";

import { useEffect, type ReactNode } from "react";

import { Icon } from "../foundation/Icon";

/** Scrim colour and modal shadow, from design.pen. */
const SCRIM = "#17131966";
const MODAL_SHADOW = "0 12px 32px #1713194D";

export interface ModalProps {
  title: string;
  children?: ReactNode;
  /** Footer buttons: one secondary and one primary, in that order. */
  actions?: ReactNode;
  onClose?: () => void;
  /** 화면 전체를 덮는 오버레이로 띄운다. Esc로 닫히고 뒤 화면 스크롤이 잠긴다. */
  floating?: boolean;
  className?: string;
}

/**
 * Modal — design.pen `Modal`, sitting on a scrim.
 *
 * Tapping the scrim closes it. This renders inline rather than in a portal so
 * it can be shown in a story; wire it to a dialog primitive in the app.
 */
export function Modal({
  title,
  children,
  actions,
  onClose,
  floating = false,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!floating) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);

    // 모달 뒤 화면이 같이 움직이면 어디를 만지는지 알 수 없다.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [floating, onClose]);

  return (
    <div
      className={`flex items-center justify-center p-6 ${floating ? "fixed inset-0 z-50" : ""}`}
      style={{ backgroundColor: SCRIM }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`flex w-[320px] flex-col overflow-hidden bg-background-surface ${className ?? ""}`}
        style={{ borderRadius: 16, boxShadow: MODAL_SHADOW }}
      >
        <header className="flex items-start justify-between gap-2.5 px-4 pt-4 pb-2.5">
          <h2 className="type-heading-sm min-w-0 flex-1 text-text-default">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 cursor-pointer text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
          >
            <Icon name="close" size={16} />
          </button>
        </header>

        {children && (
          <div className="type-body-md px-4 text-text-muted">{children}</div>
        )}

        {actions && (
          <footer className="flex justify-end gap-2 px-4 pt-3.5 pb-4">
            {actions}
          </footer>
        )}
      </div>
    </div>
  );
}
