import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { NotFoundError } from "@/lib/api/http";
import type { AuthUser } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/session";
import type { ProductDto } from "@/lib/products/dto";
import { getProductSnapshot } from "@/lib/products/service";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createClient, createServiceClient } from "@/lib/supabase/server";

import {
  PAYMENT_CANCEL_REASON,
  PAYMENT_CURRENCY,
  PAYMENT_PAY_METHOD,
  PAYMENT_TYPE_CANCEL,
  PAYMENT_TYPE_PAYMENT,
  type CancellationDto,
  type PaymentCancelResultDto,
  type PaymentCheckoutDto,
  type PaymentDto,
} from "./dto";
import { portoneCheckoutKeys } from "./env";
import {
  cancelPortOnePayment,
  getPortOnePayment,
  PortOneApiError,
  type PortOnePayment,
} from "./portone";

/**
 * 결제 데이터 접근·검증 계층.
 *
 * Supabase와 포트원을 아는 코드는 여기까지다. 라우트와 화면은 DTO만 받는다.
 *
 * 문이 넷이고 둘씩 짝을 이룬다.
 *
 * - 결제 확정: 결제창이 돌아오는 리다이렉트(`confirmPayment`)와 포트원 웹훅
 *   (`recordWebhookPayment`)
 * - 취소 확정: 사용자의 취소 요청(`cancelMyPayment`)과 포트원 취소 웹훅
 *   (`recordWebhookCancellation`)
 *
 * 각 짝은 **소유자를 정하는 방법만** 다르고, 그 앞의 검증과 뒤의 기록은 완전히
 * 같은 것을 쓴다. 두 벌로 갈라 두면 한쪽에만 검사를 추가하는 날이 반드시 온다.
 * 네 문의 §5 교차검증도 `crossCheckPayment` 하나를 공유한다 — 결제와 취소가
 * 다른 것은 "포트원이 말하는 상태" 한 줄뿐이다.
 *
 * 같은 건이 두 문으로 동시에 들어올 수 있다. 그래서 기록은 멱등하다 — 최종
 * 보장은 `payment` 테이블의 부분 unique 인덱스다(그룹키당 PAYMENT 행 하나,
 * 취소 내역 아이디당 CANCEL 행 하나).
 */

type Db = SupabaseClient<Database>;

/** 상품 행이 지워져도 결제 내역은 남는다. 그때 이름 자리에 들어갈 값. */
const DELETED_PRODUCT_NAME = "삭제된 상품";

/**
 * 결제 확정에 실패한 이유.
 *
 * 화면에 그대로 뿌릴 문구가 아니라 분기용 코드다. 실패 화면이 이 코드로 문구를
 * 고르고, 웹훅 라우트는 이 코드로 "재시도가 의미 있는가"를 가른다. 사용자에게
 * 사유를 자세히 알려 주지 않는 이유는 조작을 시도하는 쪽에게 "무엇이 걸렸는지"를
 * 가르쳐 주지 않기 위해서다 — 로그에는 전부 남는다.
 */
export const PAYMENT_FAILURE_CODES = [
  "canceled",
  "not_paid",
  "mismatch",
  "unauthorized",
  "unavailable",
] as const;

export type PaymentFailureCode = (typeof PAYMENT_FAILURE_CODES)[number];

/** 결제 실패 화면이 아는 어휘인지. 취소 쪽 코드가 섞여 오는 것을 여기서 막는다. */
export function isPaymentFailureCode(
  value: string,
): value is PaymentFailureCode {
  return (PAYMENT_FAILURE_CODES as readonly string[]).includes(value);
}

/**
 * 취소에 실패한 이유. 결제와 셋(`mismatch`·`unauthorized`·`unavailable`)을
 * 공유하고 둘이 다르다.
 *
 * 어휘를 결제와 합치지 않은 이유는 결제 실패 화면 때문이다. 그 화면은 코드마다
 * 문구를 하나씩 가진 표를 들고 있는데, 거기에 절대 도달하지 않는 취소 코드까지
 * 섞으면 쓰이지 않는 문구가 쌓인다.
 *
 * - `already_canceled` — 이미 취소된 건. 자기 결제 건의 상태라 알려 줘도 안전하다.
 * - `not_canceled` — 포트원이 아직 취소를 끝내지 않았다. 재시도가 의미 있다.
 */
export type CancelFailureCode =
  | "already_canceled"
  | "not_canceled"
  | "mismatch"
  | "unauthorized"
  | "unavailable";

export class PaymentError extends Error {
  constructor(
    readonly code: PaymentFailureCode | CancelFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

/**
 * 결제창에 넘길 값 한 벌. 결제할 수 없는 상품이면 `null`.
 *
 * `null`이 되는 경우는 둘이다 — 포트원 키가 없거나(환경 설정이 덜 됐다), 상품에
 * 가격이 없다(팔 수 있는 상태가 아니다). 둘 다 버튼을 잠가야 하는 상태이고,
 * 화면 입장에서는 구분할 이유가 없다.
 */
export function buildCheckout(
  product: ProductDto,
  user: AuthUser,
): PaymentCheckoutDto | null {
  const keys = portoneCheckoutKeys();
  if (!keys || product.price === null) return null;

  return {
    storeId: keys.storeId,
    channelKey: keys.channelKey,
    orderName: product.name,
    totalAmount: product.price,
    currency: PAYMENT_CURRENCY,
    payMethod: PAYMENT_PAY_METHOD,
    productId: product.id,
    userId: user.id,
  };
}

/**
 * 결제 확정 — 결제창이 돌아오는 리다이렉트 경로.
 *
 * 결제창에서 돌아온 `paymentId` 하나만 믿을 수 있는 입력이고, 그마저도 "이런
 * 아이디의 결제 건이 있다"는 사실 이상을 말해 주지 않는다. 나머지는 전부 포트원
 * 조회 응답과 우리 DB를 맞대어 확인한다.
 *
 * 이 경로에서 소유자는 **로그인한 사람 자신**이다. 결제 건이 말하는 사람과 지금
 * 세션의 사람이 다르면 확정하지 않는다.
 */
export async function confirmPayment(paymentId: string): Promise<void> {
  const user = await requireUser();

  // 이미 적힌 건. 웹훅이 먼저 적었을 수도 있다. 여기서 끊으면 새로고침마다
  // 포트원을 부르는 일이 없다.
  if (await findPayment(paymentId)) return;

  const verified = await verifyPaidPayment(paymentId);

  // 결제한 사람과 지금 로그인한 사람이 같은지. 남의 결제 건 ID를 주소창에 넣어
  // 자기 이름으로 적게 만드는 시도를 막는다.
  if (verified.userId !== user.id) {
    console.error(
      `[payments] 결제 건 소유자 불일치 paymentId=${paymentId} session=${user.id}`,
    );
    throw new PaymentError("unauthorized", "본인의 결제 건이 아닙니다.");
  }

  await recordPayment(await createClient(), verified);
}

/**
 * 결제 확정 — 포트원 웹훅 경로.
 *
 * 리다이렉트가 도달하지 못한 결제를 건져 내는 자리다. 브라우저를 닫았거나,
 * 네트워크가 끊겼거나, 결제창에서 돌아오는 길에 무슨 일이 있었어도 결제는 이미
 * 일어났고 그 사실은 기록되어야 한다.
 *
 * 세션이 없다. 그래서 소유자를 `auth.uid()`로 정할 수 없고, 검증을 통과한
 * 결제 건의 `customData.userId`를 쓴다. 그 값이 임의로 바뀔 수 없는 이유는
 * `crossCheckPayment`의 교차검증 때문이다 — `userId`를 바꾸면 그 사람이 그
 * 상품을 그 금액에 결제한 건이어야 하는데, 금액·주문명·채널이 전부 함께 맞아야
 * 통과한다.
 */
export async function recordWebhookPayment(paymentId: string): Promise<void> {
  // 검증이 먼저다. 서비스 롤 클라이언트는 RLS 바깥에 있으므로, 이 건이 우리
  // 주문이 맞다는 것이 확인되기 전에는 만들지 않는다.
  const verified = await verifyPaidPayment(paymentId);

  // 리다이렉트가 이미 적었는지 여기서 따로 묻지 않는다. `record_payment`가
  // 멱등하고(그룹키당 PAYMENT 행 하나), 웹훅은 이미 §5의 재조회를 지나왔다.
  await recordPayment(createServiceClient(), verified);
}

/**
 * 결제 취소 — 사용자 요청 경로.
 *
 * 순서가 전부다. **먼저 포트원에 취소하고, 그 결과를 다시 조회해 확인한 뒤에만
 * 원장에 적는다.** DB만 바꾸고 포트원에 알리지 않는 "취소"는 만들지 않는다.
 *
 * 포트원 취소가 성공한 뒤의 실패는 취소의 실패가 아니라 **기록의 실패**다. 돈은
 * 이미 돌아갔으므로 "취소하지 못했다"고 답하면 사용자가 다시 누르고 포트원은
 * 거절한다. 그래서 그 뒤로는 무엇이 실패하든 `pending`으로 답하고, 원장은 취소
 * 웹훅이 마저 적는다(멱등하므로 두 번 적히지 않는다).
 */
export async function cancelMyPayment(
  paymentId: string,
): Promise<PaymentCancelResultDto> {
  const user = await requireUser();

  // 내 결제 건인지 먼저 확인한다. 남의 건과 없는 건은 똑같이 404다 — 구분해
  // 알려 주면 주문번호를 넣어 보는 것만으로 그 번호의 실재를 알 수 있다.
  const payment = await findPayment(paymentId);
  if (!payment) {
    throw new NotFoundError("결제 내역을 찾을 수 없습니다.");
  }
  if (payment.status === "canceled") {
    throw new PaymentError("already_canceled", "이미 취소된 결제입니다.");
  }

  const cancellation = await requestCancel(paymentId);

  try {
    const verified = await verifyCancellation(paymentId, cancellation.id);

    // customData가 가리키는 사람과 지금 로그인한 사람이 같은지. 여기까지 왔다면
    // 원장이 이미 내 건이라고 말했지만, 기록에 쓸 소유자는 검증을 통과한 값이다.
    if (verified.userId !== user.id) {
      throw new PaymentError("unauthorized", "본인의 결제 건이 아닙니다.");
    }

    await recordCancellation(await createClient(), verified);
  } catch (reason) {
    console.error(
      `[payments] 취소 기록 실패 paymentId=${paymentId} cancellationId=${cancellation.id}`,
      reason,
    );
    return { status: "pending" };
  }

  return { status: "canceled" };
}

/**
 * 결제 취소 — 포트원 취소 웹훅 경로.
 *
 * 우리 화면을 거치지 않은 취소가 여기로 온다. 포트원 콘솔에서 관리자가 취소한
 * 건, 사용자 요청 경로가 기록에 실패한 건, PG가 비동기로 뒤늦게 끝낸 건이 전부
 * 이 문으로 들어온다.
 *
 * 세션이 없어 소유자를 `auth.uid()`로 정할 수 없다. 결제 경로와 같은 이유로
 * `customData.userId`를 쓰고, 그 위에 `record_cancellation`이 한 겹 더 확인한다 —
 * 그 함수는 취소 행의 소유자와 상품을 인자가 아니라 **원 결제 행에서 복사**한다.
 */
export async function recordWebhookCancellation(
  paymentId: string,
  cancellationId: string,
): Promise<void> {
  const verified = await verifyCancellation(paymentId, cancellationId);
  await recordCancellation(createServiceClient(), verified);
}

/** 결제 완료 화면이 쓰는 조회. 남의 건은 RLS가 걸러 `null`이다. */
export async function findPayment(
  paymentId: string,
): Promise<PaymentDto | null> {
  // 잘못된 형식의 id를 그대로 넘기면 Postgres가 uuid 파싱에서 던져 500이 된다.
  // 없는 결제와 형식이 틀린 id는 사용자에게 똑같이 "없음"이다.
  if (!asUuid(paymentId)) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment")
    .select(LEDGER_SELECT)
    // `id`가 아니라 그룹키로 찾는다. 원장은 행마다 새 `id`를 채번하고, 결제와
    // 그에 딸린 취소들을 `transaction_key` 하나로 묶는다. 사용자가 부르는
    // 주문번호는 그 그룹키다.
    .eq("transaction_key", paymentId);

  if (error) {
    console.error("[payments] 결제 조회 실패", error);
    throw new Error("결제 정보를 불러오지 못했습니다.");
  }

  const group = groupLedger((data ?? []) as unknown as LedgerRow[]).get(
    paymentId,
  );
  if (!group?.payment) return null;

  return toPaymentDto(group);
}

/** 결제 완료 화면용. 없으면 404다. */
export async function getPayment(paymentId: string): Promise<PaymentDto> {
  await requireUser();

  const payment = await findPayment(paymentId);
  if (!payment) {
    throw new NotFoundError("결제 내역을 찾을 수 없습니다.");
  }
  return payment;
}

/**
 * 마이 페이지 결제 내역 — 내 결제 건 전부, 최신 결제순.
 *
 * 취소된 건도 뺀 목록이 아니다. 원장은 결제를 지우지 않으므로 취소된 결제도
 * 결제 내역에 남고, 상태와 취소 금액이 함께 내려간다.
 *
 * `user_id` 조건을 쓰지 않는다. `payment`의 select 정책이 `auth.uid() = user_id`
 * 하나뿐이라 남의 행은 애초에 오지 않는다. 여기서 조건을 한 번 더 쓰면 진짜
 * 방어선이 어디인지 흐려진다.
 */
export async function listMyPayments(): Promise<PaymentDto[]> {
  const groups = groupLedger(await readMyLedger());

  return [...groups.values()]
    .filter((group) => group.payment !== null)
    .map(toPaymentDto)
    .sort((left, right) => right.paidAt.localeCompare(left.paidAt));
}

/**
 * 마이 페이지 취소 내역 — 내 취소 행 전부, 최신 취소순.
 *
 * 목록의 단위가 결제가 아니라 **취소 행 하나**다. 한 결제 건에 취소가 여러 번
 * 달릴 수 있어서(지금은 전액 취소만 하지만) 결제 단위로 묶으면 부분 취소를
 * 붙이는 날 목록의 뜻이 바뀐다.
 */
export async function listMyCancellations(): Promise<CancellationDto[]> {
  const rows = await readMyLedger();
  const groups = groupLedger(rows);

  return rows
    .filter((row) => row.type === PAYMENT_TYPE_CANCEL)
    .map((row) => ({
      id: row.id,
      paymentId: row.transaction_key,
      // 원장에는 음수로 쌓여 있다. 화면에 보여 줄 때 부호를 뗀다.
      amount: Math.abs(Number(row.amount ?? 0)),
      canceledAt: row.created_at,
      paymentAmount: Number(
        groups.get(row.transaction_key)?.payment?.amount ?? 0,
      ),
      productId: row.product_id === null ? null : String(row.product_id),
      productName: row.product?.name ?? DELETED_PRODUCT_NAME,
    }));
}

/**
 * 포트원에 전액 취소를 요청한다. 여기서부터 돈이 실제로 움직인다.
 *
 * 포트원이 거절한 이유를 상태 코드로만 갈라 받는다. 404는 없는 결제 건,
 * 409는 이미 취소되었거나 취소할 수 없는 상태다. 원장은 결제라고 말하는데
 * 포트원은 이미 취소라고 답하는 상태(콘솔에서 취소했고 웹훅이 아직 안 들어온
 * 경우)가 409로 온다 — 이때도 사용자에게는 "이미 취소된 결제"가 맞는 답이다.
 */
async function requestCancel(paymentId: string) {
  try {
    return await cancelPortOnePayment(paymentId, PAYMENT_CANCEL_REASON);
  } catch (reason) {
    if (reason instanceof PortOneApiError) {
      if (reason.status === 404) {
        throw new NotFoundError("결제 내역을 찾을 수 없습니다.");
      }
      if (reason.status === 409) {
        throw new PaymentError(
          "already_canceled",
          "이미 취소되었거나 취소할 수 없는 결제입니다.",
        );
      }
      throw new PaymentError("unavailable", reason.message);
    }
    throw reason;
  }
}

/**
 * 검증을 통과한 결제 한 건. 기록에 필요한 것만 담는다.
 *
 * 여기까지 온 값은 전부 서버가 확인한 것이다. `amount`는 DB의 상품 가격과 같은
 * 것으로 확인된 실결제액이고, `userId`는 결제 건이 말하는 사람이다.
 */
interface VerifiedPayment {
  /** 그룹키. 포트원 `paymentId` 그대로다. */
  transactionKey: string;
  userId: string;
  productId: number;
  amount: number;
  snapshotPayment: Record<string, unknown>;
  snapshotProduct: Record<string, unknown>;
}

/** 검증을 통과한 취소 한 건. */
interface VerifiedCancellation {
  /** 그룹키 = 원 결제의 `paymentId`. 취소는 원 결제와 같은 값을 쓴다. */
  transactionKey: string;
  /** 포트원이 채번한 취소 내역 아이디. 멱등 키다. */
  cancellationId: string;
  userId: string;
  /** 취소 금액. 양수로 담고 원장에 넣을 때 DB 함수가 음수로 뒤집는다. */
  amount: number;
  snapshotPayment: Record<string, unknown>;
  snapshotProduct: Record<string, unknown>;
}

/**
 * 결제 검증 — 결제 확정의 두 문이 공유한다.
 *
 * 교차검증은 `crossCheckPayment`가 하고, 여기서는 상태 한 줄만 더 본다.
 */
async function verifyPaidPayment(paymentId: string): Promise<VerifiedPayment> {
  const checked = await crossCheckPayment(paymentId);

  // 승인이 끝난 건만 기록한다. 가상계좌 발급(`VIRTUAL_ACCOUNT_ISSUED`)처럼
  // 돈이 아직 안 들어온 상태가 여기로 오면 미납을 결제로 적게 된다.
  if (checked.portone.status !== "PAID") {
    console.info(
      `[payments] 결제가 완료되지 않은 건 paymentId=${paymentId} status=${checked.portone.status}`,
    );
    throw new PaymentError("not_paid", "아직 결제가 완료되지 않았습니다.");
  }

  return {
    transactionKey: paymentId,
    userId: checked.userId,
    productId: checked.productId,
    // 부호는 방향이다. 결제는 양수, 취소는 음수로 쌓인다.
    amount: checked.amount,
    snapshotPayment: checked.portone as unknown as Record<string, unknown>,
    snapshotProduct: checked.snapshotProduct,
  };
}

/**
 * 취소 검증 — 취소 확정의 두 문이 공유한다.
 *
 * 결제 검증과 §5의 교차검증을 그대로 공유하고, 상태를 보는 줄만 다르다. 취소된
 * 건의 `status`는 `PAID`가 아니라 `CANCELLED`이기 때문이다. 금액 검사가 살아
 * 있다는 점이 중요하다 — `amount.total`은 취소해도 줄지 않으므로, 취소된 건도
 * 결제와 똑같이 "이 상품을 이 금액에 산 건이 맞는가"를 다시 묻는다.
 *
 * 전액 취소만 만들기 때문에 `PARTIAL_CANCELLED`는 통과시키지 않는다. 반쯤
 * 지원하는 취소 코드가 가장 위험하다.
 */
async function verifyCancellation(
  paymentId: string,
  cancellationId: string,
): Promise<VerifiedCancellation> {
  // 멱등 키가 될 값이다. uuid가 아니면 저장 단계에서 터지므로 여기서 거른다.
  if (!asUuid(cancellationId)) {
    return failVerification(paymentId, "mismatch", "취소 내역 ID 형식 불일치");
  }

  const checked = await crossCheckPayment(paymentId);

  if (checked.portone.status !== "CANCELLED") {
    // 아직 취소가 반영되지 않았다. 비동기로 취소를 처리하는 PG에서 일어난다.
    // 잠시 후 다시 물으면 달라질 수 있으므로 재시도가 의미 있는 실패다.
    console.info(
      `[payments] 취소가 완료되지 않은 건 paymentId=${paymentId} status=${checked.portone.status}`,
    );
    throw new PaymentError("not_canceled", "아직 취소가 완료되지 않았습니다.");
  }

  // 웹훅이 알려 준 취소 내역이 조회 응답에도 있는지. 없으면 우리 건이 아니거나
  // 위조된 아이디다.
  const cancellation = checked.portone.cancellations?.find(
    (item) => item.id === cancellationId,
  );
  if (!cancellation) {
    return failVerification(paymentId, "mismatch", "취소 내역 없음");
  }

  if (cancellation.status !== "SUCCEEDED") {
    console.info(
      `[payments] 완료되지 않은 취소 내역 paymentId=${paymentId} status=${cancellation.status}`,
    );
    throw new PaymentError("not_canceled", "아직 취소가 완료되지 않았습니다.");
  }

  // 취소 금액의 출처도 DB다. 전액 취소만 하므로 상품 가격과 같아야 한다.
  if (cancellation.totalAmount !== checked.amount) {
    return failVerification(paymentId, "mismatch", "취소 금액 불일치");
  }

  return {
    transactionKey: paymentId,
    cancellationId,
    userId: checked.userId,
    amount: cancellation.totalAmount,
    snapshotPayment: checked.portone as unknown as Record<string, unknown>,
    snapshotProduct: checked.snapshotProduct,
  };
}

/** 교차검증을 통과한 결제 건. 상태는 아직 보지 않았다. */
interface CheckedPayment {
  /** 포트원 조회 응답 원문. 스냅샷에 그대로 들어간다. */
  portone: PortOnePayment;
  /** `customData`가 말하는 사람. */
  userId: string;
  productId: number;
  /** DB 상품 가격이자 포트원이 말하는 총 결제액. 둘이 같음을 확인한 값이다. */
  amount: number;
  snapshotProduct: Record<string, unknown>;
}

/**
 * §5 교차검증 — 결제와 취소, 네 문이 모두 지나는 유일한 검증.
 *
 * 핵심은 **교차검증**이다. 우리 서버 바깥을 지나온 값들이 서로를 물게 해서,
 * 하나를 조작하면 반드시 다른 하나와 어긋나게 만든다. `customData.productId`를
 * 싼 상품으로 바꾸면 그 상품의 DB 가격과 실결제액이 안 맞고, `userId`를 바꾸면
 * 그 사람 이름으로 그 금액이 결제된 건이어야 한다.
 *
 * 세션은 보지 않는다. 웹훅에는 세션이 없기 때문이다. 소유자 확인은 부르는 쪽이
 * 자기 경로에 맞게 한다.
 *
 * 상태(`status`)도 보지 않는다. 결제는 `PAID`를, 취소는 `CANCELLED`를 요구하므로
 * 그 한 줄만 부르는 쪽이 각자 확인한다.
 */
async function crossCheckPayment(paymentId: string): Promise<CheckedPayment> {
  // 그룹키는 uuid 컬럼이다. 우리가 채번한 결제 건이라면 반드시 UUID v4다.
  // 콘솔의 웹훅 호출 테스트처럼 임의의 문자열이 오는 경우가 여기서 걸린다.
  if (!asUuid(paymentId)) {
    return failVerification(paymentId, "mismatch", "결제 건 ID 형식 불일치");
  }

  const keys = portoneCheckoutKeys();
  if (!keys) {
    console.error("[payments] 포트원 키가 없어 결제를 확정할 수 없습니다.");
    throw new PaymentError("unavailable", "결제를 확인하지 못했습니다.");
  }

  let portone;
  try {
    portone = await getPortOnePayment(paymentId);
  } catch (reason) {
    if (reason instanceof PortOneApiError) {
      throw new PaymentError("unavailable", reason.message);
    }
    throw reason;
  }

  // 포트원에 없는 결제 건. 다시 물어도 없다.
  if (!portone) {
    return failVerification(paymentId, "mismatch", "포트원에 없는 결제 건");
  }

  /*
    검증. 하나라도 어긋나면 기록하지 않는다.
    각 검사가 무엇을 막는지가 중요하다.
  */

  // 조회한 건이 요청한 건이 맞는지. 포트원이 다른 건을 줄 이유는 없지만,
  // 이 전제가 깨지면 아래 검사가 전부 엉뚱한 건을 보게 된다.
  if (portone.id !== paymentId) {
    return failVerification(paymentId, "mismatch", "결제 건 ID 불일치");
  }

  // 우리 채널을 지난 결제인지. 남의 상점에서 만든 결제 건 ID를 들고 와도 여기서
  // 걸린다. 키가 아예 없는 응답도 통과시키지 않는다.
  if (portone.channel?.key !== keys.channelKey) {
    return failVerification(paymentId, "mismatch", "채널 키 불일치");
  }

  const custom = parseCustomData(portone.customData);
  if (!custom) {
    return failVerification(paymentId, "mismatch", "customData 파싱 실패");
  }

  // 상품은 customData가 가리키는 것을 DB에서 다시 읽는다. 가격의 출처는 언제나
  // DB다 — 결제창에 실렸던 금액은 여기서 판단 근거가 되지 않는다.
  const { product, row } = await getProductSnapshot(custom.productId);

  // 금액이 없는 응답(승인 전 상태 등)을 숫자로 다루면 그 자리에서 500이 된다.
  const total = portone.amount?.total;
  if (typeof total !== "number") {
    return failVerification(paymentId, "mismatch", "결제 금액 없음");
  }
  if (product.price === null || total !== product.price) {
    // customData의 productId를 싼 상품으로 바꿔치기하면 여기서 어긋난다.
    return failVerification(paymentId, "mismatch", "결제 금액 불일치");
  }
  if (portone.currency !== PAYMENT_CURRENCY) {
    return failVerification(paymentId, "mismatch", "통화 불일치");
  }
  if (portone.orderName !== product.name) {
    return failVerification(paymentId, "mismatch", "주문명 불일치");
  }

  return {
    portone,
    userId: custom.userId,
    productId: Number(product.id),
    amount: total,
    snapshotProduct: row,
  };
}

/**
 * 원장에 결제 행을 남긴다.
 *
 * `payment`에는 insert 정책이 없다. 모든 쓰기는 `record_payment`
 * (`security definer`)를 지나고, 그 안에서 소유권과 중복을 다시 확인한다.
 *
 * 클라이언트를 인자로 받는 이유는 문이 둘이기 때문이다. 리다이렉트는 세션
 * 클라이언트로 부르고(함수 안에서 `auth.uid()`와 대조된다), 웹훅은 세션이 없어
 * 서비스 롤 클라이언트로 부른다. 부르는 함수와 인자는 양쪽이 똑같다.
 */
async function recordPayment(
  supabase: Db,
  verified: VerifiedPayment,
): Promise<void> {
  const { error } = await supabase.rpc("record_payment", {
    p_transaction_key: verified.transactionKey,
    p_user_id: verified.userId,
    p_product_id: verified.productId,
    p_amount: verified.amount,
    /*
      스냅샷 둘은 `Json`을 요구하는데, 우리가 든 값은 외부에서 온 JSON이라
      `Record<string, unknown>`이다. 실제로 넘어가는 것은 포트원 응답과
      PostgREST가 준 행이므로 둘 다 이미 Json이다.
    */
    p_snapshot_payment: verified.snapshotPayment as unknown as Json,
    p_snapshot_product: verified.snapshotProduct as unknown as Json,
  });

  if (error) {
    console.error("[payments] 결제 기록 실패", error);
    throw new PaymentError("unavailable", "결제 내역을 저장하지 못했습니다.");
  }
}

/**
 * 원장에 취소 행을 남긴다. 원 결제 행은 건드리지 않는다 — 원장은 append-only다.
 *
 * `record_cancellation`은 `record_payment`와 같은 규약이다. 소유자와 상품은
 * 인자가 아니라 원 결제 행에서 복사하고, 그룹 합계에서 취소액을 뺀 값이 0보다
 * 작아지면 거절하며, 같은 취소 내역 아이디가 다시 들어오면 기존 행 id를 돌려준다.
 */
async function recordCancellation(
  supabase: Db,
  verified: VerifiedCancellation,
): Promise<void> {
  const { error } = await supabase.rpc("record_cancellation", {
    p_transaction_key: verified.transactionKey,
    p_cancellation_id: verified.cancellationId,
    p_user_id: verified.userId,
    p_amount: verified.amount,
    p_snapshot_payment: verified.snapshotPayment as unknown as Json,
    p_snapshot_product: verified.snapshotProduct as unknown as Json,
  });

  if (error) {
    console.error("[payments] 취소 기록 실패", error);
    throw new PaymentError("unavailable", "취소 내역을 저장하지 못했습니다.");
  }
}

/**
 * 검증 실패. 사유는 로그에만 남기고 사용자에게는 한 문구로 답한다.
 *
 * 어떤 검사에서 걸렸는지 알려 주면, 값을 하나씩 바꿔 가며 통과 조건을 찾아낼 수
 * 있다. 운영자는 로그에서 본다.
 */
function failVerification(
  paymentId: string,
  code: PaymentFailureCode | CancelFailureCode,
  reason: string,
): never {
  console.error(`[payments] 결제 검증 실패 paymentId=${paymentId} ${reason}`);
  throw new PaymentError(code, "결제 정보를 확인하지 못했습니다.");
}

/**
 * 원장 한 줄. 결제 행과 취소 행이 같은 모양으로 온다.
 *
 * `amount`는 Postgres `numeric`이다. PostgREST가 숫자로 보내지만 정밀도 보존을
 * 위해 문자열로 오는 설정도 있어서, 두 경우를 모두 받아 두고 DTO로 옮길 때 숫자로
 * 못 박는다.
 */
interface LedgerRow {
  id: string;
  transaction_key: string;
  cancellation_id: string | null;
  type: string;
  amount: number | string;
  created_at: string;
  product_id: number | null;
  product: { name: string | null } | null;
}

const LEDGER_SELECT =
  "id, transaction_key, cancellation_id, type, amount, created_at, product_id, product(name)";

/** 내 원장 전부, 최신순. 남의 행은 RLS가 애초에 내려보내지 않는다. */
async function readMyLedger(): Promise<LedgerRow[]> {
  await requireUser();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment")
    .select(LEDGER_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[payments] 결제 내역 조회 실패", error);
    throw new Error("결제 내역을 불러오지 못했습니다.");
  }

  return (data ?? []) as unknown as LedgerRow[];
}

/** 그룹키로 묶은 원장 한 덩어리 — 결제 하나와 그에 딸린 취소들. */
interface LedgerGroup {
  /** 취소 행만 있고 결제 행이 없는 그룹은 있을 수 없지만, 타입으로 강제하지 않는다. */
  payment: LedgerRow | null;
  cancels: LedgerRow[];
}

function groupLedger(rows: LedgerRow[]): Map<string, LedgerGroup> {
  const groups = new Map<string, LedgerGroup>();

  for (const row of rows) {
    const group = groups.get(row.transaction_key) ?? {
      payment: null,
      cancels: [],
    };

    if (row.type === PAYMENT_TYPE_PAYMENT) {
      group.payment = row;
    } else {
      group.cancels.push(row);
    }

    groups.set(row.transaction_key, group);
  }

  return groups;
}

/**
 * 그룹 하나를 결제 내역 한 줄로.
 *
 * 상태는 컬럼이 아니라 **합계**에서 나온다. 결제 행의 금액에서 취소들을 빼고
 * 남은 것이 0 이하면 취소된 결제다. 원장은 결제 행을 덮어쓰지 않으므로 이것이
 * 유일한 판단 근거다.
 */
function toPaymentDto(group: LedgerGroup): PaymentDto {
  // 부르는 쪽이 `payment !== null`을 확인하고 넘긴다.
  const row = group.payment as LedgerRow;

  const amount = Number(row.amount ?? 0);
  const canceledAmount = group.cancels.reduce(
    (sum, cancel) => sum + Math.abs(Number(cancel.amount ?? 0)),
    0,
  );

  return {
    id: row.transaction_key,
    amount,
    paidAt: row.created_at,
    productId: row.product_id === null ? null : String(row.product_id),
    productName: row.product?.name ?? DELETED_PRODUCT_NAME,
    canceledAmount,
    status: amount - canceledAmount <= 0 ? "canceled" : "paid",
  };
}

interface PaymentCustomData {
  productId: string;
  userId: string;
}

/**
 * `customData`는 문자열로 온다(우리가 객체로 보내도 포트원은 JSON 문자열로
 * 돌려준다). 우리 서버 바깥을 지나온 값이라 모양부터 의심한다.
 */
function parseCustomData(raw: string | undefined): PaymentCustomData | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const { productId, userId } = parsed as Record<string, unknown>;
  if (typeof productId !== "string" || typeof userId !== "string") return null;
  if (productId === "" || userId === "") return null;
  // 소유자로 쓸 값이다. uuid가 아니면 저장 단계에서 터지므로 여기서 거른다.
  if (!asUuid(userId)) return null;

  return { productId, userId };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID 모양이면 그대로, 아니면 `null`. */
function asUuid(value: string | undefined): string | null {
  if (!value) return null;
  return UUID_PATTERN.test(value) ? value : null;
}
