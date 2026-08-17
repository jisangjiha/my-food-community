"use client";

/**
 * 수량 스테퍼 — design.pen `06b Payment Bottom Sheet`의 인원 선택.
 *
 * 기존 컴포넌트로 표현할 수 없어 새로 만들었다. `−`/`+`는 아이콘 세트에 minus가
 * 없어 시안대로 글리프를 쓴다.
 *
 * 상한에 닿으면 `+`를 비활성한다(PRD 284). 안내 문구는 시트가 띄운다 — 스테퍼는
 * 자기 상한만 알고 왜 그런지는 모른다.
 */
export interface StepperProps {
  value: number;
  /** 상한. `min(남은 자리, 1인당 최대)`를 시트가 계산해 넘긴다. */
  max: number;
  min?: number;
  onChange: (next: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}

export function Stepper({
  value,
  max,
  min = 1,
  onChange,
  decreaseLabel,
  increaseLabel,
}: StepperProps) {
  return (
    <div className="flex items-center gap-3.5">
      <StepButton
        label={decreaseLabel}
        glyph="−"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      />
      <span
        aria-live="polite"
        className="type-heading-md min-w-[16px] text-center text-text-default"
      >
        {value}
      </span>
      <StepButton
        label={increaseLabel}
        glyph="+"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      />
    </div>
  );
}

function StepButton({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "type-heading-md flex size-8 items-center justify-center rounded-lg border",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand",
        disabled
          ? "cursor-not-allowed border-border-default text-text-subtle"
          : "cursor-pointer border-border-strong text-text-default",
      ].join(" ")}
    >
      {glyph}
    </button>
  );
}
