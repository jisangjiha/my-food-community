/**
 * `src/lib/payments/refund.ts` 확인 — `npm run check:refund`.
 *
 * 이 저장소에는 테스트 러너가 없다. 그런데 환불 비율은 조용히 틀리는 종류의
 * 코드다. 남은 시간이 정확히 168시간일 때 100%에 드는지는 화면을 봐도 알 수
 * 없고, 틀리면 돈이 잘못 나간다. 러너를 들이는 대신 Node의 타입 스트리핑으로
 * 바로 돌아가는 확인만 남긴다.
 *
 * 확장자가 `.mts`인 이유: `package.json`에 `"type"`이 없어 `.ts`는 CommonJS로
 * 해석되고 `import` 구문이 깨진다. `scripts/address-check.mts`와 같다.
 */
import {
  refundPlanFor,
  refundRuleByKey,
  refundRuleFor,
  refundRuleLabel,
} from "../src/lib/payments/refund.ts";

const now = new Date("2026-08-17T12:00:00+09:00");
const HOUR = 3_600_000;
const at = (hoursLeft: number) => new Date(now.getTime() + hoursLeft * HOUR);

const cases: [string, unknown, unknown][] = [
  ["넉넉히 남음 (30일)", refundRuleFor(at(720), now).rate, 100],
  ["정확히 168시간 → 100%", refundRuleFor(at(168), now).rate, 100],
  ["168시간에서 1분 부족 → 50%", refundRuleFor(at(168 - 1 / 60), now).rate, 50],
  ["100시간 → 50%", refundRuleFor(at(100), now).rate, 50],
  ["정확히 72시간 → 50%", refundRuleFor(at(72), now).rate, 50],
  ["72시간에서 1분 부족 → 환불 불가", refundRuleFor(at(72 - 1 / 60), now).rate, 0],
  ["1시간 남음 → 환불 불가", refundRuleFor(at(1), now).rate, 0],
  ["이미 시작한 모임 → 환불 불가", refundRuleFor(at(-5), now).rate, 0],
  ["규정 키 (168시간)", refundRuleFor(at(168), now).key, "over_7d"],
  ["규정 키 (100시간)", refundRuleFor(at(100), now).key, "between_3_7d"],
  ["규정 키 (지남)", refundRuleFor(at(-5), now).key, "within_3d"],
  ["ISO 문자열도 받는다", refundRuleFor(at(200).toISOString(), now).key, "over_7d"],

  ["100% 환불액", refundPlanFor(50_000, at(200), now).amount, 50_000],
  ["50% 환불액", refundPlanFor(50_000, at(100), now).amount, 25_000],
  ["환불 불가면 0원", refundPlanFor(50_000, at(1), now).amount, 0],
  ["원 단위 절사", refundPlanFor(25_001, at(100), now).amount, 12_500],

  ["표 문구 · 취소 시점", refundRuleByKey("between_3_7d").period, "모임 3~7일 전"],
  ["표 문구 · 환불", refundRuleByKey("within_3d").refund, "환불 불가"],
  [
    "적용 규정 문구",
    refundRuleLabel(refundRuleByKey("between_3_7d")),
    "모임 3~7일 전 (50%)",
  ],
  [
    "적용 규정 문구 · 환불 불가",
    refundRuleLabel(refundRuleByKey("within_3d")),
    "모임 3일 이내 (환불 불가)",
  ],
];

let failed = 0;
for (const [label, actual, expected] of cases) {
  const ok = actual === expected;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}  actual=${String(actual)} expected=${String(expected)}`,
  );
}

console.log(failed === 0 ? "\nAll passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
