import { jsonError, jsonOk, withRoute } from "@/lib/api/http";
import { cancelMyPayment, PaymentError } from "@/lib/payments/service";

/**
 * 결제 취소 — 사용자가 마이 페이지에서 누르는 문.
 *
 * Next 16에서 동적 세그먼트(`params`)는 Promise다. 반드시 await 한다.
 *
 * POST인 이유: 취소는 원장에 새 행을 쌓는 변경이고, 무엇보다 **돈이 실제로
 * 움직인다.** DELETE를 쓰면 "결제 건을 지운다"로 읽히는데 원장은 지우지 않는다.
 *
 * 서비스가 포트원 취소 → 재조회 검증 → 원장 기록까지 끝내고 오므로, 여기서 하는
 * 일은 결과를 사용자에게 할 말로 옮기는 것뿐이다. 취소 사유(`reason`)를 본문으로
 * 받지 않는다 — 클라이언트가 보낸 문자열을 PG 원장에 그대로 실어 보낼 이유가 없다.
 */
type RouteParams = { params: Promise<{ paymentId: string }> };

export const POST = withRoute(
  async (_request: Request, { params }: RouteParams) => {
    const { paymentId } = await params;

    try {
      // `{ status: "canceled" | "pending" }`. `pending`도 성공이다 — 포트원이
      // 취소를 접수했고 원장은 취소 웹훅이 마저 적는다.
      return jsonOk(await cancelMyPayment(paymentId));
    } catch (reason) {
      if (reason instanceof PaymentError) {
        /*
          여기까지 오는 코드는 둘뿐이다. `cancelMyPayment`는 포트원 취소가 성공한
          뒤의 실패를 전부 `pending`으로 삼키므로, 검증 단계의 코드는 도달하지
          않는다. 남는 것은 취소를 시작조차 못 한 두 경우다.

          - `already_canceled`(409) — 요청이 지금 상태와 충돌한다. 사유를 그대로
            알려 준다. 자기 결제 건의 상태라 숨길 이유가 없고, 오히려 "왜 아무
            일도 안 일어나지"를 없앤다.
          - 그 밖(502) — 포트원 장애 등. 잠시 후 다시 하면 될 수 있다.

          없는 건과 남의 건은 `NotFoundError`로 와서 `withRoute`가 404로 옮긴다.
        */
        return jsonError(
          reason.code === "already_canceled" ? 409 : 502,
          reason.code,
          reason.message,
        );
      }
      throw reason;
    }
  },
);
