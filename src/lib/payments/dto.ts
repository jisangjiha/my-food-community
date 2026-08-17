import type { RefundRuleKey } from "./refund";

/**
 * 결제 DTO — BFF가 화면으로 내려보내는 유일한 모양.
 *
 * 서버 전용이 아니다. 시트와 취소 모달(클라이언트)이 타입을 쓴다.
 *
 * 취소 관련 값들은 `status === "canceled"`일 때만 채워진다. DB에도 같은 조건이
 * 체크 제약으로 들어 있어, 반쪽만 채워진 행은 애초에 저장되지 않는다.
 */
export interface PaymentDto {
  id: string;
  /** 사용자에게 보여 주는 식별자. 결제 완료 화면이 이걸로 조회한다. */
  orderNo: string;
  headcount: number;
  amount: number;
  method: string;
  status: "paid" | "canceled";
  paidAt: string;
  canceledAt: string | null;
  refundAmount: number | null;
  refundRate: number | null;
  refundRule: RefundRuleKey | null;
  refundCompletesAt: string | null;
  meeting: {
    id: string;
    title: string;
    startsAt: string;
    address: string;
    imageUrl: string | null;
  };
}
