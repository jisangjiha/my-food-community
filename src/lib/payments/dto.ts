/**
 * 결제 DTO — BFF가 화면으로 내려보내는 유일한 모양.
 *
 * `payment` 테이블의 Row가 아니고, 포트원 응답도 아니다. 둘 다 화면이 알아야 할
 * 것보다 훨씬 많은 것을 담고 있다.
 *
 * 서버 전용이 아니다. 결제 버튼(클라이언트 컴포넌트)이 `PaymentCheckoutDto`를,
 * 결제 완료 화면과 마이 페이지가 `PaymentDto`를, 취소 버튼이
 * `PaymentCancelResultDto`를 쓴다.
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
 * 취소 사유. 포트원 취소 API가 필수로 요구한다.
 *
 * 사용자에게 입력받지 않는다. 마이 페이지의 취소 버튼에서 오는 취소는 전부 같은
 * 사유이고, 자유 입력을 그대로 PG에 실어 보내면 우리가 통제하지 못하는 문자열이
 * 포트원 콘솔과 PG사 원장에 남는다.
 */
export const PAYMENT_CANCEL_REASON = "고객 요청";

/**
 * 환불 지연 안내.
 *
 * 취소 확인 모달과 취소 내역 탭이 같은 문장을 쓴다. 두 곳에서 각자 문구를 들고
 * 있으면 한쪽만 바뀌는 날이 오고, 사용자는 어느 쪽이 맞는지 알 수 없다.
 */
export const REFUND_DELAY_NOTE =
  "카드사에 따라 환불까지 3~5영업일이 걸릴 수 있어요.";

/**
 * 결제 건 하나의 상태. 원장 그룹의 합계에서 나온다.
 *
 * DB 컬럼이 아니다. `payment`은 상태를 덮어쓰지 않고 취소를 새 행으로 쌓는
 * insert-only 원장이라, "취소됨"은 그룹 합계가 0이 되었다는 사실의 다른 이름이다.
 */
export type PaymentStatus = "paid" | "canceled";

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

/** 결제 완료 화면과 마이 페이지 결제 내역이 쓰는 모양. 확정되어 DB에 적힌 것만 담는다. */
export interface PaymentDto {
  /** 포트원 결제 건 ID이자 우리 주문번호이자 원장의 그룹키. */
  id: string;
  /** 검증된 실결제 금액(원). 취소해도 줄지 않는다 — 원장은 덮어쓰지 않는다. */
  amount: number;
  /** ISO 8601. */
  paidAt: string;
  /** 결제한 상품. 상품이 나중에 지워져도 결제 내역은 남아야 하므로 스냅샷에서 읽는다. */
  productId: string | null;
  productName: string;
  /**
   * 이 결제 건에 딸린 취소 합계(원, 양수 표기).
   *
   * 원장에는 음수로 쌓이지만 화면에 `-10,000원 취소`처럼 부호를 두 번 보여 줄
   * 이유가 없다. 부호는 원장의 문법이지 사용자의 문법이 아니다.
   */
  canceledAmount: number;
  status: PaymentStatus;
}

/**
 * 취소 내역 한 건 — 마이 페이지 취소 내역 탭이 쓰는 모양.
 *
 * 결제 건이 아니라 **원장의 취소 행 하나**다. 한 결제 건에 취소가 여러 번 달릴
 * 수 있으므로(지금은 전액 취소만 하지만) 목록의 단위는 결제가 아니라 취소다.
 */
export interface CancellationDto {
  /** 원장 행 id. 목록의 key로 쓴다. */
  id: string;
  /** 원 결제 건의 주문번호. 문의할 때 부르는 번호는 언제나 이것이다. */
  paymentId: string;
  /** 취소 금액(원, 양수 표기). */
  amount: number;
  /** ISO 8601. 원장에 취소 행이 적힌 시각이다. */
  canceledAt: string;
  /** 원 결제 금액(원). 부분 취소가 생기면 이 둘이 달라진다. */
  paymentAmount: number;
  productId: string | null;
  productName: string;
}

/**
 * 취소 요청의 결과.
 *
 * `pending`은 실패가 아니다. 취소가 비동기로 처리되는 PG에서 포트원이 취소를
 * 접수만 한 상태(`REQUESTED`)이며, 원장에는 아직 적지 않는다 — 돌려주기로 한
 * 것과 돌려준 것은 다르다. 그 건은 잠시 후 취소 웹훅이 마저 적는다.
 */
export interface PaymentCancelResultDto {
  status: "canceled" | "pending";
}
