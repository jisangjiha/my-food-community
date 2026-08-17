"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { formatWon } from "../../lib/meetings/format";
import { cancelPayment, type PayFormState } from "../../lib/payments/actions";
import { Button } from "../ui/Button";
import { DetailRow } from "../ui/DetailRow";
import { Modal } from "../ui/Modal";

export interface CancelPaymentModalProps {
  paymentId: string;
  meetingTitle: string;
  headcount: number;
  amount: number;
  /** 서버가 계산한 환불 예정 금액. 표시용이고 확정은 액션이 다시 한다. */
  refundAmount: number;
  /** `모임 3~7일 전 (50%)`. */
  ruleLabel: string;
  /** 닫으면 돌아갈 곳. */
  closeHref: string;
}

/**
 * 결제 취소 확인 — design.pen `05d My Page - Cancel Confirm`.
 *
 * 결제 금액 · 적용 규정 · 환불 예정 금액을 함께 보여 준다(PRD 315).
 *
 * 금액은 서버가 계산해 props로 내려온다. 클라이언트에서 다시 계산하면 사용자 기기
 * 시각에 따라 다른 규정이 보일 수 있다.
 */
export function CancelPaymentModal({
  paymentId,
  meetingTitle,
  headcount,
  amount,
  refundAmount,
  ruleLabel,
  closeHref,
}: CancelPaymentModalProps) {
  const router = useRouter();
  const close = () => router.replace(closeHref, { scroll: false });
  const [state, formAction, pending] = useActionState<PayFormState, FormData>(
    cancelPayment,
    {},
  );

  return (
    <Modal
      floating
      title="결제를 취소할까요?"
      onClose={close}
      actions={
        <form action={formAction} className="flex w-full gap-2">
          <input type="hidden" name="paymentId" value={paymentId} />
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={close}
          >
            돌아가기
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="lg"
            className="flex-1"
            loading={pending}
          >
            결제 취소
          </Button>
        </form>
      }
    >
      <div className="flex flex-col gap-4 pb-1">
        <p className="type-body-md text-text-muted">
          {`${meetingTitle} · ${headcount}명`}
        </p>

        <div className="flex flex-col gap-2.5 rounded-xl bg-background-subtle p-3.5">
          <DetailRow label="결제 금액">{formatWon(amount)}</DetailRow>
          <DetailRow label="적용 규정">{ruleLabel}</DetailRow>
          <span aria-hidden className="h-px w-full bg-border-default" />
          {/* 환불 예정 금액만 값이 크다. DetailRow의 14px로는 시안과 어긋난다. */}
          <div className="flex items-center justify-between gap-3">
            <span className="type-label-md shrink-0 text-text-muted">
              환불 예정 금액
            </span>
            <span className="type-heading-md text-text-brand">
              {formatWon(refundAmount)}
            </span>
          </div>
        </div>

        <p className="type-label-md text-text-subtle">
          환불 규정에 따라 일부 금액만 환불돼요. 취소 후에는 되돌릴 수 없어요.
        </p>

        {state.error && (
          <p role="alert" className="type-label-md text-text-error">
            {state.error}
          </p>
        )}
      </div>
    </Modal>
  );
}
