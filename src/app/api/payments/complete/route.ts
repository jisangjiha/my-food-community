import { UnauthorizedError } from "@/lib/auth/session";
import {
  confirmPayment,
  PaymentError,
  type PaymentFailureCode,
} from "@/lib/payments/service";

/**
 * 결제창이 돌아오는 자리 — 포트원 `redirectUrl`이 가리키는 곳.
 *
 * 페이지가 아니라 Route Handler인 이유: 여기서 하는 일이 결제 확정, 곧 DB에
 * 행을 쓰는 변경이기 때문이다. CLAUDE.md 규칙상 변경은 Route Handler나 서버
 * 액션에서만 한다. 서버 컴포넌트에서 하면 새로고침·뒤로가기·프리페치가 전부
 * 결제 확정을 다시 태우는 경로가 된다.
 *
 * 그래서 흐름이 둘로 갈린다 — 이 라우트가 확정하고, 사용자가 보는 화면
 * (`/payments/[paymentId]`)은 조회만 한다. 완료 화면을 몇 번을 새로고쳐도
 * 결제가 다시 일어나지 않는다.
 *
 * `withRoute`로 감싸지 않는다. 그 래퍼는 JSON 에러를 돌려주는데, 여기로 오는
 * 것은 브라우저의 화면 이동이라 JSON을 보여 줄 수 없다. 실패도 화면으로 보낸다.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("paymentId");
  // 실패 시 포트원이 붙여 주는 값. 있으면 결제창에서 이미 실패한 것이다.
  const failureCode = url.searchParams.get("code");

  if (failureCode !== null) {
    console.info(
      `[payments] 결제창 실패 code=${failureCode} message=${url.searchParams.get("message") ?? ""}`,
    );
    return redirectTo(url, "/payments/failed", { reason: "canceled" });
  }

  if (!paymentId) {
    return redirectTo(url, "/payments/failed", { reason: "unavailable" });
  }

  try {
    await confirmPayment(paymentId);
  } catch (reason) {
    return redirectTo(url, "/payments/failed", {
      reason: toFailureReason(reason),
    });
  }

  return redirectTo(url, `/payments/${paymentId}`);
}

function toFailureReason(reason: unknown): PaymentFailureCode {
  if (reason instanceof PaymentError) return reason.code;
  // 세션이 끊긴 채 돌아온 경우. 결제는 됐는데 우리가 누구인지 모르는 상태다.
  if (reason instanceof UnauthorizedError) return "unauthorized";

  console.error("[payments] 결제 확정 중 처리되지 않은 오류", reason);
  return "unavailable";
}

/**
 * 같은 오리진의 화면으로 보낸다.
 *
 * 303을 쓴다. 302는 원 요청의 메서드를 유지할 수 있어 애매한데, 303은 "결과를
 * 보려면 GET으로 저기를 봐라"라는 뜻이라 지금 상황과 정확히 맞는다.
 */
function redirectTo(
  base: URL,
  pathname: string,
  query?: Record<string, string>,
): Response {
  const target = new URL(pathname, base.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    target.searchParams.set(key, value);
  }

  return Response.redirect(target, 303);
}
