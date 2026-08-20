"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  REFUND_DELAY_NOTE,
  type PaymentCancelResultDto,
} from "../../lib/payments/dto";
import { formatWon } from "../../lib/products/format";
import { Button } from "../ui/Button";
import { DetailRow } from "../ui/DetailRow";
import { Modal } from "../ui/Modal";
import { Toast } from "../ui/Toast";

export interface CancelPaymentButtonProps {
  /** 주문번호이자 원장의 그룹키. 취소 요청 경로에 그대로 들어간다. */
  paymentId: string;
  productName: string;
  /** 결제 금액(원). 확인 모달에 보여 줄 표시용 값이다. */
  amount: number;
}

/**
 * 결제 내역 카드의 취소 버튼과 확인 모달.
 *
 * 마이 페이지는 서버 컴포넌트라 목록을 서비스에서 직접 읽지만, 취소는 사용자
 * 조작이라 브라우저에서 일어난다. 그래서 이 조각만 클라이언트다. 부르는 곳은
 * BFF 라우트 하나(`POST /api/payments/{paymentId}/cancel`)이고, 포트원도
 * Supabase도 여기서 보이지 않는다 — `DeletePlaceButton`과 같은 모양이다.
 *
 * 모달에 보이는 금액은 **표시용**이다. 실제로 얼마가 취소되는지는 서버가 DB의
 * 상품 가격으로 다시 정한다. 브라우저가 보낸 숫자로는 아무것도 결정하지 않는다.
 *
 * 취소한 뒤에는 `router.refresh()`로 서버 컴포넌트를 다시 그린다. 목록을
 * 클라이언트 상태로 따로 들고 있으면 카드의 상태와 취소 내역 탭이 어긋나는
 * 순간이 생긴다. 한 번 다시 그리면 둘 다 같은 응답에서 나온다.
 */
export function CancelPaymentButton({
  paymentId,
  productName,
  amount,
}: CancelPaymentButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const busy = sending || refreshing;

  async function handleCancel() {
    setError(null);
    setSending(true);

    try {
      const response = await fetch(
        `/api/payments/${encodeURIComponent(paymentId)}/cancel`,
        { method: "POST" },
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        // BFF는 실패를 항상 `{ error: { code, message } }`로 준다. 그 문구를
        // 그대로 보여 준다. 여기서 다시 지어내면 서버가 아는 이유가 화면에서
        // 사라진다.
        setError(body?.error?.message ?? "결제를 취소하지 못했습니다.");
        setSending(false);
        return;
      }

      setOpen(false);

      /*
        `pending`은 실패가 아니다. 포트원이 취소를 접수했지만 아직 끝나지 않은
        상태이고, 원장은 취소 웹훅이 마저 적는다. "취소했어요"라고 단정하면
        취소 내역 탭에 아무것도 없는 이유를 설명할 수 없다.
      */
      const result = body as PaymentCancelResultDto | null;
      if (result?.status === "pending") {
        setNotice(
          "취소 요청이 접수되었어요. 처리가 끝나면 취소 내역에 나타납니다.",
        );
      }

      /*
        성공하면 `sending`을 되돌리지 않는다. 취소된 건은 다시 그린 카드에서
        버튼 자리가 안내 문구로 바뀌므로 이 컴포넌트가 사라지고, `pending`이라
        카드가 그대로 남는 경우에도 버튼은 잠긴 채여야 한다 — 이미 접수된 취소를
        한 번 더 누르면 포트원이 거절한다.
      */
      startRefresh(() => router.refresh());
    } catch {
      setError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSending(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        결제 취소
      </Button>

      {open && (
        <Modal
          floating
          title="결제를 취소할까요?"
          onClose={busy ? undefined : () => setOpen(false)}
          actions={
            <div className="flex w-full gap-2">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                돌아가기
              </Button>
              <Button
                variant="destructive"
                size="lg"
                className="flex-1"
                loading={sending}
                onClick={handleCancel}
              >
                결제 취소
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4 pb-1">
            <p className="type-body-md text-text-muted">{productName}</p>

            <div className="flex flex-col gap-2.5 rounded-xl bg-background-subtle p-3.5">
              <DetailRow label="결제 금액">{formatWon(amount)}</DetailRow>
              <span aria-hidden className="h-px w-full bg-border-default" />
              {/* 환불 금액만 값이 크다. DetailRow의 14px로는 무게가 안 실린다. */}
              <div className="flex items-center justify-between gap-3">
                <span className="type-label-md shrink-0 text-text-muted">
                  환불 금액
                </span>
                <span className="type-heading-md text-text-brand">
                  {formatWon(amount)}
                </span>
              </div>
            </div>

            <p className="type-label-md text-text-subtle">
              {`전액이 결제 수단으로 환불돼요. ${REFUND_DELAY_NOTE} 취소 후에는 되돌릴 수 없어요.`}
            </p>

            {error && (
              <p role="alert" className="type-label-md text-text-error">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* 모달이 닫힌 뒤의 알림. 모달 안에 두면 닫는 순간 같이 사라진다. */}
      {notice && (
        <Toast
          variant="info"
          onClose={() => setNotice(null)}
          className="fixed inset-x-4 bottom-4 z-50 md:left-auto md:right-6 md:w-[400px]"
        >
          {notice}
        </Toast>
      )}
    </>
  );
}
