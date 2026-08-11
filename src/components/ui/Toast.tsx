import { Icon } from "../foundation/Icon";
import type { IconName } from "../../tokens/icons";

export type ToastVariant = "success" | "error" | "info" | "warning";

/** Accent bar, glyph and glyph colour per variant, from design.pen. */
const VARIANTS: Record<
  ToastVariant,
  { accent: string; tone: string; icon: IconName }
> = {
  success: {
    accent: "bg-border-success",
    tone: "text-text-success",
    icon: "check",
  },
  error: { accent: "bg-border-error", tone: "text-text-error", icon: "error" },
  info: { accent: "bg-border-info", tone: "text-text-info", icon: "info" },
  warning: {
    accent: "bg-border-warning",
    tone: "text-text-warning",
    icon: "warning",
  },
};

/** The design file's drop shadow. */
const SHADOW = "0 6px 16px #4A305422";

export interface ToastProps {
  variant?: ToastVariant;
  children: string;
  /** Omit to hide the close control. */
  onClose?: () => void;
  /** Desktop is 400px; mobile fills the screen minus its margins. */
  className?: string;
}

export function Toast({
  variant = "success",
  children,
  onClose,
  className,
}: ToastProps) {
  const spec = VARIANTS[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 border border-border-default bg-background-surface ${className ?? ""}`}
      style={{
        borderRadius: 12,
        padding: "12px 14px",
        boxShadow: SHADOW,
      }}
    >
      <span
        aria-hidden
        className={`shrink-0 rounded-sm ${spec.accent}`}
        style={{ width: 4, height: 24 }}
      />
      <span className={`shrink-0 ${spec.tone}`} aria-hidden>
        <Icon name={spec.icon} size={20} />
      </span>
      <p className="type-body-md min-w-0 flex-1 text-text-default">
        {children}
      </p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="shrink-0 cursor-pointer text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
        >
          <Icon name="close" size={20} />
        </button>
      )}
    </div>
  );
}
