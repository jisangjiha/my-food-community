/**
 * 환불 규정 — `02-prd.md`의 "환불 규정 (확정)".
 *
 * 서버 전용이 아니다. 모임 상세·결제 시트·완료 화면·취소 모달 네 곳이 같은 문구를
 * 써야 하므로(PRD 340) 표와 판정을 한 곳에 둔다.
 *
 * 비율만 여기 있고 정원·총액은 SQL이 정한다. 정원은 원자성이 필요해 트랜잭션
 * 안에 있어야 하고, 비율은 경계값 검증이 필요해 오프라인에서 돌아가야 한다.
 * 판정 기준 시각은 항상 서버가 넘긴 `now`다 — 사용자 기기 시각을 믿지 않는다.
 */

export type RefundRuleKey = "over_7d" | "between_3_7d" | "within_3d";

export interface RefundRule {
  key: RefundRuleKey;
  /** 이 구간에 들려면 모임 시작까지 남아 있어야 하는 최소 시간. */
  minHoursBefore: number;
  /** 환불 비율(%). */
  rate: number;
  /** 규정 표의 "취소 시점" 칸. */
  period: string;
  /** 규정 표의 "환불" 칸. */
  refund: string;
}

/**
 * 남은 시간이 많은 순. `refundRuleFor`가 위에서부터 처음 맞는 칸을 고르므로
 * 순서가 규칙의 일부다.
 */
export const REFUND_RULES: readonly RefundRule[] = [
  {
    key: "over_7d",
    minHoursBefore: 168,
    rate: 100,
    period: "모임 7일 전까지",
    refund: "100%",
  },
  {
    key: "between_3_7d",
    minHoursBefore: 72,
    rate: 50,
    period: "모임 3~7일 전",
    refund: "50%",
  },
  {
    key: "within_3d",
    minHoursBefore: 0,
    rate: 0,
    period: "모임 3일 이내",
    refund: "환불 불가",
  },
];

/** 규정 표 아래 각주. 네 화면이 같은 문장을 쓴다. */
export const REFUND_BASIS_NOTE = "모임 시작 시각(KST) 기준으로 계산됩니다.";

export interface RefundPlan {
  rule: RefundRule;
  /** 이 시점에 취소하면 돌려받는 금액. 원 단위 절사. */
  amount: number;
}

/**
 * 이 시점에 취소하면 어느 칸에 걸리는지.
 *
 * 경계는 "이상"이 유리한 쪽에 붙는다 — 남은 시간이 정확히 168시간이면 100%,
 * 정확히 72시간이면 50%다(PRD 338). 이미 시작한 모임은 남은 시간이 음수라
 * 어느 칸에도 걸리지 않으므로 마지막 칸(환불 불가)으로 떨어진다.
 */
export function refundRuleFor(
  startsAt: string | Date,
  now: Date = new Date(),
): RefundRule {
  const starts = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  const hoursLeft = (starts.getTime() - now.getTime()) / 3_600_000;

  return (
    REFUND_RULES.find((rule) => hoursLeft >= rule.minHoursBefore) ??
    REFUND_RULES[REFUND_RULES.length - 1]
  );
}

/**
 * 환불 금액까지 계산한다.
 *
 * 절사는 내림이다. 올림하면 규정보다 많이 돌려주게 되고, 그 차이는 매번
 * 서비스가 부담한다.
 */
export function refundPlanFor(
  amount: number,
  startsAt: string | Date,
  now: Date = new Date(),
): RefundPlan {
  const rule = refundRuleFor(startsAt, now);
  return { rule, amount: Math.floor((amount * rule.rate) / 100) };
}

/** 취소 모달·취소 내역이 쓰는 "모임 3~7일 전 (50%)" 형태. */
export function refundRuleLabel(rule: RefundRule): string {
  return rule.rate === 0
    ? `${rule.period} (환불 불가)`
    : `${rule.period} (${rule.rate}%)`;
}

/**
 * 저장된 규정 키를 다시 규정으로.
 *
 * 취소된 결제는 그때의 키를 들고 있다. 규정이 바뀌어도 이미 취소된 건은 당시
 * 문구로 보여야 하므로, 키를 보관하고 문구만 여기서 붙인다.
 */
export function refundRuleByKey(key: RefundRuleKey): RefundRule {
  const rule = REFUND_RULES.find((candidate) => candidate.key === key);
  if (!rule) {
    throw new Error(`알 수 없는 환불 규정: ${key}`);
  }
  return rule;
}
