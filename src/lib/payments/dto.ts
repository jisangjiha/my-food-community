/**
 * 결제 DTO — BFF가 화면으로 내려보내는 유일한 모양.
 *
 * `payment` 테이블의 Row가 아니고, 포트원 응답도 아니다. 둘 다 화면이 알아야 할
 * 것보다 훨씬 많은 것을 담고 있다.
 *
 * 서버 전용이 아니다. 결제 버튼(클라이언트 컴포넌트)이 `PaymentCheckoutDto`를,
 * 결제 완료 화면이 `PaymentDto`를 쓴다.
 */

/**
 * 결제 통화. 원화만 판다.
 *
 * 포트원 SDK와 REST 응답이 같은 문자열을 쓰므로, 요청에 실을 때와 응답을 검증할
 * 때 이 상수 하나를 양쪽에서 쓴다.
 */
export const PAYMENT_CURRENCY = "KRW";

/**
 * 결제 수단. 카드만 받는다.
 *
 * 채널이 카드 하나라 화면에 고를 것이 없다. 수단이 늘면 이 값이 사용자 선택으로
 * 바뀌고, 그때 `payment.type`이 아니라 별도 컬럼이 필요해진다.
 */
export const PAYMENT_PAY_METHOD = "CARD";

/**
 * `payment.type` 값.
 *
 * DB가 자유 텍스트라 값을 강제하지 않는다. 결제와 취소가 같은 테이블에 쌓이므로
 * 문자열을 여기 한 번만 적어 둔다.
 */
export const PAYMENT_TYPE_PAYMENT = "PAYMENT";
export const PAYMENT_TYPE_CANCEL = "CANCEL";

/**
 * 결제창을 여는 데 필요한 것 전부.
 *
 * 금액과 주문명이 여기 들어 있는 이유는 결제창이 그것을 요구하기 때문이지, 이
 * 값이 신뢰의 근거이기 때문이 아니다. 브라우저를 지난 값은 전부 조작될 수 있다.
 * 진짜 판단은 결제 후 서버가 포트원에 다시 물어서 한다(`service.ts`의
 * `confirmPayment`).
 *
 * `paymentId`는 여기 없다. 브라우저가 결제를 누르는 순간 만든다 — 화면을 열어
 * 두기만 하고 결제하지 않은 사용자에게까지 결제 건 ID를 미리 나눠 줄 이유가 없다.
 */
export interface PaymentCheckoutDto {
  storeId: string;
  channelKey: string;
  orderName: string;
  totalAmount: number;
  currency: typeof PAYMENT_CURRENCY;
  payMethod: typeof PAYMENT_PAY_METHOD;
  /** 결제창이 `customData`에 실어 보낼 값. 서버가 되받아 교차검증한다. */
  productId: string;
  userId: string;
}

/** 결제 완료 화면이 쓰는 모양. 확정되어 DB에 적힌 것만 담는다. */
export interface PaymentDto {
  /** 포트원 결제 건 ID이자 우리 주문번호. */
  id: string;
  /** 검증된 실결제 금액(원). */
  amount: number;
  /** ISO 8601. */
  paidAt: string;
  /** 결제한 상품. 상품이 나중에 지워져도 결제 내역은 남아야 하므로 스냅샷에서 읽는다. */
  productId: string | null;
  productName: string;
}
