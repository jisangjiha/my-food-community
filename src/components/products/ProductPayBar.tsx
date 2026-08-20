"use client";

import * as PortOne from "@portone/browser-sdk/v2";
import { useState } from "react";

import type { PaymentCheckoutDto } from "../../lib/payments/dto";
import { formatWon } from "../../lib/products/format";
import { Icon } from "../foundation/Icon";
import { Button } from "../ui/Button";
import { ButtonLink } from "../ui/ButtonLink";

export interface ProductPayBarProps {
  /** 결제할 수 없는 상태면 `null`. 가격이 없거나 포트원 키가 없을 때다. */
  checkout: PaymentCheckoutDto | null;
  /** 표시용 가격. `checkout`이 없어도 가격은 보여 준다. */
  price: number | null;
  /** 비로그인일 때 로그인 후 돌아올 경로. */
  loginHref: string | null;
}

/**
 * 상품 상세 하단의 결제 바 — 화면 폭과 무관하게 계속 하단에 고정된다.
 *
 * 결제 CTA는 스크롤 위치와 상관없이 늘 보여야 한다. `lg`에서 우측 레일로
 * 옮기는 안은 쓰지 않았다 — 폭에 따라 CTA 자리가 옮겨 다니면 같은 흐름이
 * 화면마다 달라 보인다.
 *
 * 클라이언트 컴포넌트인 이유는 포트원 SDK가 브라우저에서만 돌기 때문이다.
 * `storeId`·`channelKey`는 서버가 읽어 prop으로 내려준다(`payments/env.ts`).
 */
export function ProductPayBar({
  checkout,
  price,
  loginHref,
}: ProductPayBarProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!checkout) return;

    setPending(true);
    setError(null);

    try {
      const response = await PortOne.requestPayment({
        storeId: checkout.storeId,
        channelKey: checkout.channelKey,
        // 결제 건 ID. 결제를 누르는 순간 만든다 — 화면만 열어 두고 결제하지
        // 않는 사용자에게까지 미리 나눠 줄 이유가 없다.
        paymentId: crypto.randomUUID(),
        orderName: checkout.orderName,
        totalAmount: checkout.totalAmount,
        currency: checkout.currency,
        payMethod: checkout.payMethod,
        /*
          결과는 리다이렉트로만 받는다(`forceRedirect: true`).

          이 값이 없으면 PC는 반환값으로, 모바일은 리다이렉트로 갈려서 완료 처리
          경로를 두 벌 만들어야 한다. 리다이렉트 하나로 고정하면 결제 확정이
          서버 라우트 한 곳에서만 일어나고, 완료 화면은 조회만 하는 화면이 되어
          새로고침·뒤로가기에 안전해진다.

          `redirectUrl`은 절대 URL이어야 한다. `window.location.origin`을 쓰면
          로컬·프리뷰·운영에서 각각 스스로 맞는 값이 되므로 환경변수가 필요 없다.
        */
        redirectUrl: `${window.location.origin}/api/payments/complete`,
        forceRedirect: true,
        // 서버가 되받아 교차검증할 값. 이 값 자체는 신뢰하지 않는다 —
        // productId를 바꾸면 그 상품 가격과 실결제액이 어긋나 검증에서 걸린다.
        customData: {
          productId: checkout.productId,
          userId: checkout.userId,
        },
      });

      /*
        `forceRedirect: true`라 성공하면 여기까지 오지 않는다. 그래도 결제창을
        열기 전에 SDK가 거절하는 경우(파라미터 오류 등)가 있어 반환값을 본다.
      */
      if (response?.code !== undefined) {
        setError(response.message ?? "결제를 진행하지 못했습니다.");
        setPending(false);
      }
    } catch (reason) {
      console.error("[payments] 결제창 호출 실패", reason);
      setError("결제를 진행하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setPending(false);
    }
  }

  return (
    <div className="sticky bottom-0 z-30 border-t border-border-default bg-background-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-2 px-4 py-3 md:px-24 lg:px-32">
        {error && (
          <p
            role="alert"
            className="type-label-md flex items-center gap-1 text-text-error"
          >
            <Icon name="error" size={16} />
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="type-label-md text-text-muted">1인 가격</span>
            <span className="type-heading-sm truncate text-text-default">
              {price === null ? "가격 미정" : formatWon(price)}
            </span>
          </span>

          {loginHref ? (
            // 비로그인. 결제 자체를 막지 않고 로그인으로 보낸 뒤 이 화면으로
            // 되돌린다. 누른 자리를 잃지 않는다.
            <ButtonLink href={loginHref} size="lg" className="min-w-[140px]">
              로그인하고 결제
            </ButtonLink>
          ) : (
            <Button
              size="lg"
              className="min-w-[140px]"
              disabled={!checkout}
              loading={pending}
              onClick={handlePay}
            >
              {checkout ? "결제하기" : "결제 준비 중"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
