import { AppShell } from "../../../components/layout/AppShell";
import { PageContainer } from "../../../components/layout/PageContainer";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { Empty } from "../../../components/ui/Empty";
import type { PaymentFailureCode } from "../../../lib/payments/service";

/**
 * 결제 실패.
 *
 * `/api/payments/complete`가 확정에 실패했을 때 보내는 화면이다. 확정 실패의
 * 사유는 여러 가지지만 사용자가 할 수 있는 일은 대체로 하나(다시 시도)라,
 * 문구만 바꾸고 행동은 같게 둔다.
 *
 * 실패 사유를 자세히 적지 않는다. "금액이 안 맞습니다" 같은 문구는 조작을
 * 시도하는 쪽에게 무엇이 걸렸는지 알려 주는 셈이다. 정확한 사유는 서버 로그에
 * 남는다.
 */

const MESSAGES: Record<PaymentFailureCode, { title: string; description: string }> =
  {
    canceled: {
      title: "결제를 취소했어요",
      description: "결제창에서 결제가 중단되었어요. 다시 시도할 수 있어요.",
    },
    not_paid: {
      title: "아직 결제가 완료되지 않았어요",
      description:
        "결제 승인이 끝나지 않았어요. 잠시 후 다시 시도해 주세요. 금액이 빠져나갔다면 그대로 두고 문의해 주세요.",
    },
    mismatch: {
      title: "결제 정보를 확인하지 못했어요",
      description:
        "결제 내용이 주문과 맞지 않아 처리를 멈췄어요. 결제된 금액이 있다면 자동으로 취소됩니다.",
    },
    unauthorized: {
      title: "로그인이 필요해요",
      description:
        "결제하는 사이 로그인이 풀렸어요. 다시 로그인하면 결제 내역을 확인할 수 있어요.",
    },
    unavailable: {
      title: "결제를 확인하지 못했어요",
      description:
        "일시적인 문제로 결제 확인이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.",
    },
  };

const DEFAULT_REASON: PaymentFailureCode = "unavailable";

export default async function PaymentFailedPage(
  props: PageProps<"/payments/failed">,
) {
  const { reason } = await props.searchParams;
  const message = MESSAGES[toFailureCode(reason)];

  return (
    <AppShell tabBar={false}>
      <PageContainer
        as="main"
        width="form"
        className="flex flex-col justify-center py-8 md:py-32"
      >
        <Empty
          icon="error"
          title={message.title}
          description={message.description}
          actions={
            <>
              <ButtonLink href="/products" variant="secondary" size="lg">
                상품 목록
              </ButtonLink>
              <ButtonLink href="/" size="lg">
                홈으로
              </ButtonLink>
            </>
          }
        />
      </PageContainer>
    </AppShell>
  );
}

/** 주소창으로 아무 값이나 올 수 있다. 아는 코드가 아니면 일반 문구로 떨어진다. */
function toFailureCode(
  value: string | string[] | undefined,
): PaymentFailureCode {
  if (typeof value !== "string") return DEFAULT_REASON;
  return value in MESSAGES ? (value as PaymentFailureCode) : DEFAULT_REASON;
}
