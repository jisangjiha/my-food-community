import { REFUND_RULES, type RefundRuleKey } from "../../lib/payments/refund";

/** 시안이 100%는 초록, 50%는 기본, 환불 불가는 빨강으로 쓴다. */
const REFUND_TONE: Record<RefundRuleKey, string> = {
  over_7d: "text-text-success",
  between_3_7d: "text-text-default",
  within_3d: "text-text-error",
};

/**
 * 환불 규정 표 — design.pen `06 Meeting Detail`의 `rf-table`.
 *
 * 표 내용은 `refund.ts`에서 온다. 상세·결제 완료 화면이 같은 표를 쓰고, 규정이
 * 바뀌면 두 화면과 판정 코드가 함께 바뀐다.
 *
 * 진짜 `<table>`로 쓴다. 두 열이 서로 대응하는 표라 스크린 리더가 "취소 시점"과
 * "환불"을 짝지어 읽어야 한다.
 */
export function RefundPolicyTable({ className }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border-default bg-background-surface ${className ?? ""}`}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-background-subtle">
            <th className="type-label-lg px-3.5 py-2.5 text-left text-text-default">
              취소 시점
            </th>
            <th className="type-label-lg px-3.5 py-2.5 text-right text-text-default">
              환불
            </th>
          </tr>
        </thead>
        <tbody>
          {REFUND_RULES.map((rule, index) => (
            <tr
              key={rule.key}
              className={
                index === 0 ? "border-t border-border-default" : undefined
              }
            >
              <td className="type-body-md px-3.5 py-2.5 text-text-muted">
                {rule.period}
              </td>
              <td
                className={`type-label-lg px-3.5 py-2.5 text-right ${REFUND_TONE[rule.key]}`}
              >
                {rule.refund}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
