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
  PAYMENT_CURRENCY,
  PAYMENT_PAY_METHOD,
  PAYMENT_TYPE_PAYMENT,
  type PaymentCheckoutDto,
  type PaymentDto,
} from "./dto";
import { portoneCheckoutKeys } from "./env";
import { getPortOnePayment, PortOneApiError } from "./portone";

/**
 * 결제 데이터 접근·검증 계층.
 *
 * Supabase와 포트원을 아는 코드는 여기까지다. 라우트와 화면은 DTO만 받는다.
 *
 * 결제 확정으로 들어오는 문이 둘이다. 하나는 결제창이 돌아오는 리다이렉트
 * (`confirmPayment`), 하나는 포트원이 직접 부르는 웹훅(`recordWebhookPayment`).
 * 둘은 소유자를 정하는 방법만 다르고, 그 앞의 검증(`verifyPaidPayment`)과 뒤의
 * 기록(`record_payment`)은 완전히 같은 것을 쓴다. 두 벌로 갈라 두면 한쪽에만
 * 검사를 추가하는 날이 반드시 온다.
 *
 * 두 문이 같은 건을 동시에 확정하려 들 수 있다. 그래서 기록은 멱등하다 —
 * 최종 보장은 `payment` 테이블의 부분 unique 인덱스(그룹키당 PAYMENT 행 하나)다.
 */

type Db = SupabaseClient<Database>;

/**
 * 결제 확정에 실패한 이유.
 *
 * 화면에 그대로 뿌릴 문구가 아니라 분기용 코드다. 실패 화면이 이 코드로 문구를
 * 고르고, 웹훅 라우트는 이 코드로 "재시도가 의미 있는가"를 가른다. 사용자에게
 * 사유를 자세히 알려 주지 않는 이유는 조작을 시도하는 쪽에게 "무엇이 걸렸는지"를
 * 가르쳐 주지 않기 위해서다 — 로그에는 전부 남는다.
 */
export type PaymentFailureCode =
  | "canceled"
  | "not_paid"
  | "mismatch"
  | "unauthorized"
  | "unavailable";

export class PaymentError extends Error {
  constructor(
    readonly code: PaymentFailureCode,
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
 * `verifyPaidPayment`의 교차검증 때문이다 — `userId`를 바꾸면 그 사람이 그
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
    .select("transaction_key, amount, created_at, product_id, product(name)")
    // `id`가 아니라 그룹키로 찾는다. 원장은 행마다 새 `id`를 채번하고, 결제와
    // 그에 딸린 취소들을 `transaction_key` 하나로 묶는다. 사용자가 부르는
    // 주문번호는 그 그룹키다.
    .eq("transaction_key", paymentId)
    .eq("type", PAYMENT_TYPE_PAYMENT)
    .maybeSingle();

  if (error) {
    console.error("[payments] 결제 조회 실패", error);
    throw new Error("결제 정보를 불러오지 못했습니다.");
  }
  if (!data) return null;

  return {
    id: data.transaction_key,
    amount: Number(data.amount ?? 0),
    paidAt: data.created_at,
    productId: data.product_id === null ? null : String(data.product_id),
    productName: data.product?.name ?? "삭제된 상품",
  };
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

/**
 * 결제 검증 — 두 경로가 공유하는 유일한 검증.
 *
 * 핵심은 **교차검증**이다. 우리 서버 바깥을 지나온 값들이 서로를 물게 해서,
 * 하나를 조작하면 반드시 다른 하나와 어긋나게 만든다. `customData.productId`를
 * 싼 상품으로 바꾸면 그 상품의 DB 가격과 실결제액이 안 맞고, `userId`를 바꾸면
 * 그 사람 이름으로 그 금액이 결제된 건이어야 한다.
 *
 * 세션은 보지 않는다. 웹훅에는 세션이 없기 때문이다. 소유자 확인은 부르는 쪽이
 * 자기 경로에 맞게 한다.
 */
async function verifyPaidPayment(paymentId: string): Promise<VerifiedPayment> {
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

  // 승인이 끝난 건만 기록한다. 가상계좌 발급(`VIRTUAL_ACCOUNT_ISSUED`)처럼
  // 돈이 아직 안 들어온 상태가 여기로 오면 미납을 결제로 적게 된다.
  if (portone.status !== "PAID") {
    console.info(
      `[payments] 결제가 완료되지 않은 건 paymentId=${paymentId} status=${portone.status}`,
    );
    throw new PaymentError("not_paid", "아직 결제가 완료되지 않았습니다.");
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

  if (product.price === null || portone.amount.total !== product.price) {
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
    transactionKey: paymentId,
    userId: custom.userId,
    productId: Number(product.id),
    // 부호는 방향이다. 결제는 양수, 취소는 음수로 쌓는다.
    amount: portone.amount.total,
    snapshotPayment: portone as unknown as Record<string, unknown>,
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
 * 검증 실패. 사유는 로그에만 남기고 사용자에게는 한 문구로 답한다.
 *
 * 어떤 검사에서 걸렸는지 알려 주면, 값을 하나씩 바꿔 가며 통과 조건을 찾아낼 수
 * 있다. 운영자는 로그에서 본다.
 */
function failVerification(
  paymentId: string,
  code: PaymentFailureCode,
  reason: string,
): never {
  console.error(`[payments] 결제 검증 실패 paymentId=${paymentId} ${reason}`);
  throw new PaymentError(code, "결제 정보를 확인하지 못했습니다.");
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
