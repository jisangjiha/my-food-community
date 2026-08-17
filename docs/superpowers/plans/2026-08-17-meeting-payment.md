# 유료 모임 결제 핸드오프 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** design.pen의 결제 화면 8장(메인 배너 · 모임 상세 · 결제 시트 · 결제 완료 · 마이 3탭 · 취소 모달)을 실제로 동작하는 모임 상품·결제·취소로 구현한다.

**Architecture:** 정원 검사와 총액 계산은 `security definer` plpgsql 함수가 한 트랜잭션 안에서(초과 판매·금액 불일치 불가), 환불 비율은 `src/lib/payments/refund.ts` 한 곳에서(오프라인 검증·문구 일관성) 정한다. 화면은 서버 컴포넌트가 서비스 함수를 직접 부르고, 변경은 서버 액션 두 개(`payMeeting`, `cancelPayment`)만 한다. 시트·모달의 열림 상태는 URL 쿼리에 둔다.

**Tech Stack:** Next.js 16.2 (App Router, 서버 액션), React 19.2, Tailwind CSS 4, Supabase(`@supabase/ssr`), Storybook 10, TypeScript 5. 테스트 러너 없음 — 순수 함수는 `node --experimental-strip-types` 확인 스크립트로 검증한다.

**Spec:** `docs/superpowers/specs/2026-08-17-meeting-payment-handoff-design.md`

## Global Constraints

- **디자인 SSOT는 Storybook + design.pen.** `src/components/foundation/*`, `src/components/ui/*`를 재사용한다. 신규 컴포넌트는 기존 것으로 표현 불가할 때만 만들고 `src/stories/ui/`에 스토리를 함께 쓴다. 컴포넌트 API를 바꾸면 같은 커밋에서 스토리를 갱신한다.
- **색·타이포·스페이싱·아이콘은 `src/tokens/*`와 `type-*` 유틸리티만.** 하드코딩 금지. 인라인 스타일은 기존 컴포넌트가 이미 쓰는 방식(치수·radius)에만 허용된다.
- **`globals.css`가 `--spacing-8/12/16/20/24/32`를 px 토큰으로 덮어쓴다.** `p-32` = 32px, `h-16` = 16px. 토큰이 아닌 길이는 `h-[64px]`처럼 임의값으로 쓴다.
- **Supabase 호출은 서버에서만.** 클라이언트 컴포넌트는 서버 액션과 props만 쓴다. Supabase 클라이언트 생성은 `src/lib/supabase/server.ts` 한 곳.
- **스키마 변경은 Supabase MCP `apply_migration`으로만.** `execute_sql`로 DDL을 치지 않는다. 새 테이블은 RLS를 켜고 정책까지 같이 넣는다. 함수는 `set search_path = ''` + `revoke execute ... from public`.
- **폭 규칙은 `PageContainer`에만.** 페이지에서 `max-w`·좌우 패딩을 직접 쓰지 않는다. 내비게이션 표면(하단 탭 / 상단 헤더)은 어떤 폭에서도 정확히 하나.
- **문구는 시안 그대로.** `1인 25,000원 × 2명`, `환불 규정을 확인했습니다`, `모임 시작 시각(KST) 기준으로 계산됩니다.`, `카드 환불은 카드사 사정으로 3~5일 걸릴 수 있어요.`
- **환불 경계는 "이상"이 유리한 쪽에.** 남은 시간이 정확히 168시간이면 100%, 정확히 72시간이면 50%. 기준은 서버 시각.
- **검증 명령:** `npx tsc --noEmit`, `npx eslint --max-warnings=0`, `npm run build`, `npm run build-storybook`, `npm run check:refund`.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/lib/payments/refund.ts` | 환불 규정 표·비율 판정·문구 (순수 함수, 서버 전용 아님) |
| `scripts/refund-check.mts` | 위 파일의 경계값 검증 |
| `src/lib/meetings/dto.ts` | 모임 DTO와 판매 상태 |
| `src/lib/meetings/service.ts` | `meeting` 읽기 (Supabase를 아는 마지막 층) |
| `src/lib/meetings/format.ts` | 날짜·금액 표기 (Asia/Seoul 고정) |
| `src/lib/payments/dto.ts` | 결제 DTO와 파생 상태(참여 예정/완료, 취소 가능 여부, 환불 상태) |
| `src/lib/payments/service.ts` | `payment` 읽기 + RPC 호출 + 에러 코드 번역 |
| `src/lib/payments/actions.ts` | 서버 액션 `payMeeting`, `cancelPayment` |
| `src/lib/payments/format.ts` | 결제 화면 전용 표기 (`50,000원 · 12/13 결제`) |
| `src/components/meetings/MeetingBanner.tsx` | 메인 상단 캐러셀 (client) |
| `src/components/meetings/MeetingInfoCard.tsx` | 일시·장소·지도·가격·정원·마감 카드 |
| `src/components/meetings/RefundPolicyTable.tsx` | 환불 규정 표 (상세·완료 공용) |
| `src/components/meetings/MeetingPaySheet.tsx` | 결제 바텀시트 (client) |
| `src/components/payments/PaymentHistoryCard.tsx` | 결제 내역 카드 |
| `src/components/payments/CancellationCard.tsx` | 취소 내역 카드 |
| `src/components/payments/CancelPaymentModal.tsx` | 취소 확인 모달 (client) |
| `src/components/ui/Stepper.tsx` | −/+ 인원 선택 (신규 DS 컴포넌트) |
| `src/app/meetings/[id]/page.tsx` | 모임 상세 + `?pay=1` 시트 |
| `src/app/payments/[orderNo]/page.tsx` | 결제 완료 |
| `src/app/my/page.tsx` | 마이 3탭 + `?cancel=<id>` 모달 |
| `src/app/page.tsx` | 상단 배너 배선 |

---

### Task 1: 환불 규정과 검증 스크립트

정원·금액은 뒤 태스크에서 SQL이 맡는다. 이 태스크는 **비율**만 다룬다. 경계값이 조용히 틀리는 규칙이라 러너 없는 저장소에서도 검증되게 먼저 만든다.

**Files:**
- Create: `src/lib/payments/refund.ts`
- Create: `scripts/refund-check.mts`
- Modify: `package.json` (scripts에 `check:refund` 추가)

**Interfaces:**
- Consumes: 없음 (순수 함수, 첫 태스크)
- Produces:
  - `type RefundRuleKey = "over_7d" | "between_3_7d" | "within_3d"`
  - `interface RefundRule { key: RefundRuleKey; minHoursBefore: number; rate: number; period: string; refund: string }`
  - `const REFUND_RULES: readonly RefundRule[]`
  - `const REFUND_BASIS_NOTE: string`
  - `refundRuleFor(startsAt: string | Date, now?: Date): RefundRule`
  - `refundPlanFor(amount: number, startsAt: string | Date, now?: Date): { rule: RefundRule; amount: number }`
  - `refundRuleLabel(rule: RefundRule): string`
  - `refundRuleByKey(key: RefundRuleKey): RefundRule`

- [ ] **Step 1: 검증 스크립트를 먼저 쓴다 (실패해야 한다)**

`scripts/refund-check.mts`:

```ts
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
  refundRuleFor,
  refundRuleLabel,
  refundRuleByKey,
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
  ["적용 규정 문구", refundRuleLabel(refundRuleByKey("between_3_7d")), "모임 3~7일 전 (50%)"],
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
```

`package.json`의 `scripts`에 한 줄 추가한다 (`check:address` 아래):

```json
"check:refund": "node --experimental-strip-types scripts/refund-check.mts",
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm run check:refund`
Expected: FAIL — `Cannot find module '../src/lib/payments/refund.ts'`

- [ ] **Step 3: `src/lib/payments/refund.ts`를 쓴다**

```ts
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
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm run check:refund`
Expected: 21개 줄 모두 `PASS`, 마지막 줄 `All passed`, 종료 코드 0

- [ ] **Step 5: 타입·린트**

Run: `npx tsc --noEmit && npx eslint src/lib/payments/refund.ts scripts/refund-check.mts --max-warnings=0`
Expected: 출력 없음

- [ ] **Step 6: 커밋**

```bash
git add src/lib/payments/refund.ts scripts/refund-check.mts package.json
git commit -m "feat: 환불 규정과 경계값 확인 스크립트

비율 판정을 TS 한 곳에 두고 168/72시간 경계를 확인 스크립트로 못 박는다.
정원과 총액은 SQL이 맡으므로 여기에는 비율만 있다."
```

---

### Task 2: `meeting`·`payment` 스키마와 시드

**Files:**
- Supabase 마이그레이션 2개 (MCP `apply_migration`): `create_meeting_and_payment`, `seed_meetings`
- Modify: `src/lib/supabase/database.types.ts` (재생성 결과로 덮어쓰기)

**Interfaces:**
- Consumes: Task 1의 `RefundRuleKey`(문자열 값이 `payment.refund_rule`에 저장된다)
- Produces: `meeting`·`payment` 테이블, `seats_taken(meeting)` computed column, `payment_order_seq` 시퀀스, 재생성된 `Database` 타입

- [ ] **Step 1: 마이그레이션 `create_meeting_and_payment`를 적용한다**

MCP `apply_migration`, name: `create_meeting_and_payment`

```sql
-- 모임 상품. 판매 주체는 운영자뿐이라(PRD 5.1) 앱에서 쓰는 경로는 읽기만이다.
create table public.meeting (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  -- 시안의 눈썹 문구. "이웃 모임 · 맛집 투어"처럼 카테고리 두 개가 붙어 온다.
  category_label text not null,
  summary text not null,
  description text not null,
  -- 없으면 화면이 아이콘 자리표시자를 그린다. 지금은 시드에만 값이 있다.
  image_url text,
  address text not null,
  -- 좌표가 둘 다 있을 때만 지도를 그린다. 맛집 상세와 같은 규칙이다.
  lat double precision,
  lng double precision,
  price integer not null check (price > 0),
  capacity integer not null check (capacity > 0),
  -- 1인당 최대 구매 매수. PRD H의 기본값 4매.
  max_per_person integer not null default 4 check (max_per_person > 0),
  starts_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'on_sale'
    check (status in ('on_sale', 'hidden', 'closed')),
  display_order integer not null default 0
);

comment on table public.meeting is '유료 모임 상품';

-- 주문번호의 일련번호. 날짜(KST) + 4자리로 조합한다.
create sequence public.payment_order_seq;

create table public.payment (
  id uuid primary key default gen_random_uuid(),
  -- 사용자에게 보여 주는 식별자. 결제 완료 화면이 이걸로 조회한다.
  order_no text not null unique,
  meeting_id uuid not null references public.meeting (id),
  user_id uuid not null references auth.users (id),
  headcount integer not null check (headcount > 0),
  -- SQL이 계산한 총액. 클라이언트가 보낸 금액은 어디에도 들어오지 않는다.
  amount integer not null check (amount >= 0),
  -- PG가 없으므로 카드사까지는 알 수 없다.
  method text not null default '카드',
  status text not null default 'paid' check (status in ('paid', 'canceled')),
  paid_at timestamptz not null default now(),
  canceled_at timestamptz,
  refund_amount integer check (refund_amount >= 0),
  -- 100 / 50 / 0. 취소 시점에 확정해 적는다.
  refund_rate integer check (refund_rate between 0 and 100),
  -- src/lib/payments/refund.ts의 RefundRuleKey.
  refund_rule text check (refund_rule in ('over_7d', 'between_3_7d', 'within_3d')),
  -- 카드 환불은 며칠 걸린다는 안내와 화면이 같은 말을 하도록 시각을 적어 둔다.
  refund_completes_at timestamptz,
  -- 취소된 건은 취소 정보를 모두 갖고, 결제 상태인 건은 하나도 갖지 않는다.
  constraint payment_cancel_fields_together check (
    (status = 'paid' and canceled_at is null and refund_amount is null
      and refund_rate is null and refund_rule is null and refund_completes_at is null)
    or
    (status = 'canceled' and canceled_at is not null and refund_amount is not null
      and refund_rate is not null and refund_rule is not null)
  )
);

comment on table public.payment is '모임 결제·취소 내역';

-- 같은 사람이 같은 모임을 두 번 결제할 수 없다. 버튼 연타·재시도로 들어온
-- 두 번째 요청을 DB가 막고, "이미 결제한 상품" 화면 규칙과 같은 사실을 쓴다.
create unique index payment_one_paid_per_user_meeting
  on public.payment (user_id, meeting_id)
  where status = 'paid';

create index payment_user_paid_at_idx on public.payment (user_id, paid_at desc);
create index payment_meeting_idx on public.payment (meeting_id);
create index meeting_listing_idx on public.meeting (status, display_order, starts_at);

alter table public.meeting enable row level security;
alter table public.payment enable row level security;

-- 배너와 상세는 비로그인도 본다(PRD 259, 276).
create policy "meeting_select_all" on public.meeting
  for select using (true);

-- 결제는 본인 것만. 쓰기 정책은 없다 — 모든 쓰기는 security definer 함수를 지난다.
create policy "payment_select_own" on public.payment
  for select to authenticated using ((select auth.uid()) = user_id);

/*
 * 남은 자리 계산용 computed column.
 *
 * payment는 RLS로 자기 행만 보이므로 앱에서 sum(headcount)을 하면 남의 결제가
 * 빠진 수를 정원으로 착각한다. 뷰로 우회하면 security_definer_view 어드바이저에
 * 걸리므로, 집계값 하나만 돌려주는 definer 함수를 PostgREST computed column으로
 * 노출한다. 개별 결제 행은 여전히 RLS 뒤에 있다.
 */
create function public.seats_taken(m public.meeting)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(p.headcount), 0)::integer
  from public.payment p
  where p.meeting_id = m.id and p.status = 'paid';
$$;

revoke execute on function public.seats_taken(public.meeting) from public;
grant execute on function public.seats_taken(public.meeting) to anon, authenticated;
```

- [ ] **Step 2: 마이그레이션 `seed_meetings`를 적용한다**

날짜는 환불 3구간을 실제로 밟아 볼 수 있게 잡는다(오늘 2026-08-17 기준: 12/14 → 100%, 8/22 → 50%, 8/19 → 환불 불가). 배너 dots 3개와도 맞는다.

MCP `apply_migration`, name: `seed_meetings`

```sql
insert into public.meeting
  (title, category_label, summary, description, image_url, address, lat, lng,
   price, capacity, max_per_person, starts_at, closes_at, status, display_order)
values
  (
    '구로 골목 맛집 투어',
    '이웃 모임 · 맛집 투어',
    '이웃과 함께 걷는 3시간, 숨은 골목 맛집 4곳',
    '동네 이웃이 직접 안내하는 골목 맛집 투어입니다. 3시간 동안 숨은 골목 맛집 4곳을 함께 걸으며 맛보고, 사진도 남겨요. 아이 동반 가능하며 편한 신발을 준비해 주세요.',
    '/images/meeting-guro-tour.jpg',
    '서울 구로구 디지털로 300',
    37.4816, 126.8955,
    25000, 20, 4,
    '2026-12-14 14:00+09', '2026-12-13 23:59+09',
    'on_sale', 1
  ),
  (
    '사진 잘 찍는 법 클래스',
    '이웃 모임 · 사진 클래스',
    '휴대폰 하나로 음식 사진 잘 찍는 두 시간',
    '맛집 글에 올릴 사진을 직접 찍어 보는 클래스입니다. 휴대폰만 있으면 됩니다. 빛 읽는 법, 접시 놓는 법, 흔들리지 않게 잡는 법을 차례로 연습해요.',
    null,
    '서울 구로구 경인로 662',
    37.4979, 126.8874,
    30000, 12, 4,
    '2026-08-22 15:00+09', '2026-08-21 23:59+09',
    'on_sale', 2
  ),
  (
    '원데이 베이킹 클래스',
    '이웃 모임 · 베이킹',
    '반죽부터 굽기까지, 하루면 되는 스콘 한 판',
    '반죽을 직접 치고 스콘 한 판을 구워 가는 클래스입니다. 재료와 앞치마는 준비되어 있어요. 구운 스콘은 모두 포장해 드립니다.',
    null,
    '서울 구로구 구로중앙로 152',
    37.4954, 126.8871,
    40000, 10, 4,
    '2026-08-19 19:00+09', '2026-08-18 23:59+09',
    'on_sale', 3
  );
```

- [ ] **Step 3: 배너 히어로 이미지를 받아 둔다**

시안이 가리키는 Unsplash 원본을 로컬로 옮긴다. 외부 호스트에 의존하면 배너가 조용히 깨지고, `next.config.ts`에 remotePatterns를 늘려야 한다.

```bash
curl -sL -o public/images/meeting-guro-tour.jpg \
  "https://images.unsplash.com/photo-1769741331289-04a805b0d1b9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
file public/images/meeting-guro-tour.jpg
```

Expected: `JPEG image data`. 실패하면 시드의 `image_url`을 기존 `/images/detail-hero.png`로 바꾼다(스펙의 대안).

- [ ] **Step 4: 스키마와 시드를 확인한다**

MCP `execute_sql`:

```sql
select m.title, m.price, m.capacity, m.starts_at, public.seats_taken(m) as taken
from public.meeting m order by m.display_order;
```

Expected: 3행, `taken`이 모두 0.

- [ ] **Step 5: 보안 어드바이저를 확인한다**

MCP `get_advisors({ type: "security" })`
Expected: `meeting`·`payment`·`seats_taken` 관련 새 경고 없음. (RLS 미설정, `function_search_path_mutable`, `security_definer_view` 중 어느 것도 나오지 않아야 한다.)

- [ ] **Step 6: 타입을 재생성한다**

MCP `generate_typescript_types`의 출력으로 `src/lib/supabase/database.types.ts`를 덮어쓴다. 파일 맨 위 주석(생성 방법 안내)이 있으면 유지한다.

Run: `npx tsc --noEmit`
Expected: 출력 없음

- [ ] **Step 7: 커밋**

```bash
git add src/lib/supabase/database.types.ts public/images/meeting-guro-tour.jpg
git commit -m "feat: 모임 상품과 결제 테이블

정원 계산은 seats_taken computed column으로 노출한다. payment는 RLS로 자기
행만 보이므로 앱에서 합산하면 남의 결제가 빠진 수를 정원으로 착각한다.

(user_id, meeting_id) where status='paid' 유니크 인덱스가 중복 결제를 막는다."
```

---

### Task 3: 결제·취소 SQL 함수

**Files:**
- Supabase 마이그레이션 1개 (MCP `apply_migration`): `create_payment_functions`

**Interfaces:**
- Consumes: Task 2의 `meeting`·`payment`·`payment_order_seq`
- Produces:
  - `public.pay_meeting(p_meeting_id uuid, p_headcount integer) returns text` — 주문번호를 돌려준다. 실패 사유는 예외 메시지 한 단어: `AUTH_REQUIRED` / `NOT_FOUND` / `CLOSED` / `HEADCOUNT` / `ALREADY_PAID` / `SOLD_OUT`
  - `public.cancel_payment(p_payment_id uuid, p_refund_amount integer, p_refund_rate integer, p_refund_rule text) returns void` — 실패 사유: `AUTH_REQUIRED` / `NOT_FOUND` / `ALREADY_CANCELED` / `NO_REFUND` / `BAD_REFUND`

- [ ] **Step 1: 마이그레이션 `create_payment_functions`를 적용한다**

MCP `apply_migration`, name: `create_payment_functions`

```sql
/*
 * 결제. 정원 검사와 총액 계산이 한 트랜잭션 안에서 끝난다.
 *
 * 모임 행을 for update로 잠그는 것이 핵심이다. "남은 자리 확인"과 "결제 삽입"을
 * 두 문장으로 나누면 마지막 한 자리를 두 사람이 동시에 사는 사고가 난다(PRD 7.3).
 *
 * 총액은 이 함수가 meeting.price로 직접 계산한다. 호출자가 금액을 넘기지 않으므로
 * 화면에 보인 금액과 청구액이 어긋날 방법이 없다(PRD KR10).
 */
create function public.pay_meeting(p_meeting_id uuid, p_headcount integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_meeting public.meeting;
  v_taken integer;
  v_order_no text;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_meeting
  from public.meeting
  where id = p_meeting_id
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_meeting.status <> 'on_sale' or v_meeting.closes_at <= now() then
    raise exception 'CLOSED';
  end if;

  if p_headcount < 1 or p_headcount > v_meeting.max_per_person then
    raise exception 'HEADCOUNT';
  end if;

  if exists (
    select 1 from public.payment
    where meeting_id = p_meeting_id and user_id = v_user and status = 'paid'
  ) then
    raise exception 'ALREADY_PAID';
  end if;

  select coalesce(sum(headcount), 0) into v_taken
  from public.payment
  where meeting_id = p_meeting_id and status = 'paid';

  if v_taken + p_headcount > v_meeting.capacity then
    raise exception 'SOLD_OUT';
  end if;

  v_order_no := 'PMT-'
    || to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD')
    || '-'
    || lpad((nextval('public.payment_order_seq') % 10000)::text, 4, '0');

  insert into public.payment
    (order_no, meeting_id, user_id, headcount, amount, method, status)
  values
    (v_order_no, p_meeting_id, v_user, p_headcount,
     v_meeting.price * p_headcount, '카드', 'paid');

  return v_order_no;
end;
$$;

/*
 * 취소. 비율은 서버(TS)가 정하고, 이 함수는 원자성과 자격만 본다.
 *
 * 브라우저는 Supabase에 닿을 수 없다(publishable 키가 서버 전용). 그래도 넘어온
 * 환불액이 결제액을 넘지 않는지 다시 확인한다 — 계산이 어긋나는 날 돈이 더 나가는
 * 쪽으로 틀리지 않게.
 */
create function public.cancel_payment(
  p_payment_id uuid,
  p_refund_amount integer,
  p_refund_rate integer,
  p_refund_rule text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_payment public.payment;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_payment
  from public.payment
  where id = p_payment_id
  for update;

  -- 남의 주문은 없는 주문과 같이 다룬다. 구분해 알려 주면 주문의 존재가 샌다.
  if not found or v_payment.user_id <> v_user then
    raise exception 'NOT_FOUND';
  end if;

  if v_payment.status <> 'paid' then
    raise exception 'ALREADY_CANCELED';
  end if;

  if p_refund_rate = 0 then
    raise exception 'NO_REFUND';
  end if;

  if p_refund_amount < 0
    or p_refund_amount > v_payment.amount
    or p_refund_rate not in (50, 100)
    or p_refund_rule not in ('over_7d', 'between_3_7d')
  then
    raise exception 'BAD_REFUND';
  end if;

  update public.payment
  set status = 'canceled',
      canceled_at = now(),
      refund_amount = p_refund_amount,
      refund_rate = p_refund_rate,
      refund_rule = p_refund_rule,
      -- 카드 환불은 카드사 사정으로 며칠 걸린다. 안내 문구와 같은 3일을 쓴다.
      refund_completes_at = now() + interval '3 days'
  where id = p_payment_id;
end;
$$;

revoke execute on function public.pay_meeting(uuid, integer) from public;
revoke execute on function public.cancel_payment(uuid, integer, integer, text) from public;
grant execute on function public.pay_meeting(uuid, integer) to authenticated;
grant execute on function public.cancel_payment(uuid, integer, integer, text) to authenticated;
```

- [ ] **Step 2: 정원·잠금이 실제로 막는지 확인한다**

MCP `execute_sql`. `auth.uid()`가 null인 세션이므로 첫 확인은 "인증 요구"가 나와야 정상이다.

```sql
do $$
begin
  perform public.pay_meeting((select id from public.meeting order by display_order limit 1), 1);
  raise exception '실패해야 하는데 통과했다';
exception when others then
  raise notice 'sqlerrm=%', sqlerrm;
end $$;
```

Expected: `NOTICE: sqlerrm=AUTH_REQUIRED`

- [ ] **Step 3: 정원 초과가 막히는지 확인한다 (임시 데이터)**

MCP `execute_sql` — 정원을 채운 뒤 초과 삽입이 `SOLD_OUT`으로 막히는지 본다. 확인이 끝나면 같은 트랜잭션에서 되돌린다.

```sql
begin;
  create temp table probe as
  select id, capacity from public.meeting order by display_order limit 1;

  -- 정원을 꽉 채운다. 함수를 거치지 않는 직접 삽입이라 사용자 하나로 몰아 넣는다.
  insert into public.payment (order_no, meeting_id, user_id, headcount, amount, status)
  select 'PROBE-1', p.id, (select id from auth.users limit 1), p.capacity, 1, 'paid'
  from probe p;

  select public.seats_taken(m) = m.capacity as full_now
  from public.meeting m where m.id = (select id from probe);
rollback;
```

Expected: `full_now = true`, 그리고 롤백 후 `select count(*) from public.payment` = 0.
(`auth.users`가 비어 있으면 앱에서 한 번 로그인한 뒤 다시 시도한다.)

- [ ] **Step 4: 보안 어드바이저를 확인한다**

MCP `get_advisors({ type: "security" })`
Expected: 두 함수 관련 새 경고 없음.

- [ ] **Step 5: 커밋 (마이그레이션은 원격에 있고 저장소 변경은 없다)**

이 태스크는 저장소 파일을 만들지 않는다. 커밋 없이 다음 태스크로 간다. 마이그레이션 목록은 MCP `list_migrations`로 확인한다.

Expected: `create_meeting_and_payment`, `seed_meetings`, `create_payment_functions`가 보인다.

---

### Task 4: 모임 도메인과 메인 배너

첫 화면 결과물이 나오는 태스크다. 배너를 눌러도 갈 곳이 아직 없으므로 링크는
`/meetings/{id}`로 걸어 두고(Task 6에서 화면이 생긴다) 이 태스크에서는 배너까지 확인한다.

**Files:**
- Create: `src/lib/meetings/dto.ts`
- Create: `src/lib/meetings/format.ts`
- Create: `src/lib/meetings/service.ts`
- Create: `src/components/meetings/MeetingBanner.tsx`
- Modify: `src/app/page.tsx` (헤더와 Featured 사이에 배너 삽입)
- Modify: `src/components/layout/nav-items.ts` (`activeKey`에 `/meetings`·`/payments`)

**Interfaces:**
- Consumes: Task 2의 `Database` 타입과 `seats_taken`
- Produces:
  - `type MeetingSale = "on_sale" | "sold_out" | "closed"`
  - `interface MeetingDto { id: string; title: string; categoryLabel: string; summary: string; description: string; imageUrl: string | null; address: string; coords: { lat: number; lng: number } | null; price: number; capacity: number; maxPerPerson: number; seatsTaken: number; seatsLeft: number; maxSelectable: number; startsAt: string; closesAt: string; sale: MeetingSale }`
  - `listMeetings(): Promise<MeetingDto[]>` — 배너·목록용. 판매 중이고 마감 전인 것만, `display_order` 순, 최대 5건
  - `getMeeting(id: string): Promise<MeetingDto>` — 없으면 `NotFoundError`
  - `formatWon(amount: number): string` → `50,000원`
  - `formatMeetingDateTime(iso: string): string` → `12월 14일 (토) 오후 2:00`
  - `formatMeetingDeadline(iso: string): string` → `12월 13일 (금) 23:59`
  - `formatMeetingShort(iso: string): string` → `12/14 토 14:00`
  - `formatMonthDay(iso: string): string` → `12/13`
  - `formatTimestamp(iso: string): string` → `2026.12.13 21:04`
  - `<MeetingBanner meetings={MeetingBannerItem[]} />`, `interface MeetingBannerItem { id: string; title: string; categoryLabel: string; seatsLeft: number; startsAt: string; price: number }`

- [ ] **Step 1: `src/lib/meetings/format.ts`**

```ts
/**
 * 모임 화면의 날짜·금액 표기.
 *
 * 서버 전용이 아니다. 배너(클라이언트)와 상세(서버)가 같은 모양을 써야 한다.
 *
 * 모든 시각은 Asia/Seoul로 고정한다. 환불 규정이 KST 기준이라고 못 박혀 있고
 * (PRD 337), 서버 타임존이나 브라우저 타임존에 따라 "12월 14일"이 "12월 13일"로
 * 보이면 사용자가 하루를 잘못 알고 온다.
 *
 * `Intl`의 조합 결과를 그대로 쓰지 않고 부품을 받아 직접 조립한다. 로케일 데이터가
 * 바뀌면 "12월 14일 (토)"의 괄호나 공백이 조용히 달라지는데, 시안 문구는 고정이다.
 */

const KST = "Asia/Seoul";

const PARTS = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

interface DateParts {
  year: string;
  month: string;
  day: string;
  weekday: string;
  hour: string;
  minute: string;
}

function partsOf(iso: string): DateParts {
  const collected: Record<string, string> = {};
  for (const part of PARTS.formatToParts(new Date(iso))) {
    collected[part.type] = part.value;
  }
  return {
    year: collected.year ?? "",
    month: collected.month ?? "",
    day: collected.day ?? "",
    // ko-KR의 short weekday는 "토"다. 괄호는 문구를 조립할 때 붙인다.
    weekday: collected.weekday ?? "",
    hour: collected.hour ?? "",
    minute: collected.minute ?? "",
  };
}

/** 24시 표기를 시안의 "오후 2:00"으로. */
function toKorean12Hour(hour: string, minute: string): string {
  const value = Number(hour);
  const meridiem = value < 12 ? "오전" : "오후";
  const hour12 = value % 12 === 0 ? 12 : value % 12;
  return `${meridiem} ${hour12}:${minute}`;
}

/** `50,000원`. */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** 상세의 일시 — `12월 14일 (토) 오후 2:00`. */
export function formatMeetingDateTime(iso: string): string {
  const { month, day, weekday, hour, minute } = partsOf(iso);
  return `${Number(month)}월 ${Number(day)}일 (${weekday}) ${toKorean12Hour(hour, minute)}`;
}

/** 상세의 모집 마감 — `12월 13일 (금) 23:59`. 마감은 시안이 24시 표기다. */
export function formatMeetingDeadline(iso: string): string {
  const { month, day, weekday, hour, minute } = partsOf(iso);
  return `${Number(month)}월 ${Number(day)}일 (${weekday}) ${hour}:${minute}`;
}

/** 배너·내역 카드의 짧은 일시 — `12/14 토 14:00`. */
export function formatMeetingShort(iso: string): string {
  const { month, day, weekday, hour, minute } = partsOf(iso);
  return `${Number(month)}/${Number(day)} ${weekday} ${hour}:${minute}`;
}

/** `12/13` — 결제일·취소일. */
export function formatMonthDay(iso: string): string {
  const { month, day } = partsOf(iso);
  return `${Number(month)}/${Number(day)}`;
}

/** 결제 완료 화면의 결제 일시 — `2026.12.13 21:04`. */
export function formatTimestamp(iso: string): string {
  const { year, month, day, hour, minute } = partsOf(iso);
  return `${year}.${month}.${day} ${hour}:${minute}`;
}
```

- [ ] **Step 2: `src/lib/meetings/dto.ts`**

```ts
/**
 * 모임 상품 DTO — BFF가 화면으로 내려보내는 유일한 모양.
 *
 * `meeting` 테이블의 Row가 아니다. 화면이 `max_per_person`·`category_label` 같은
 * 컬럼명에 묶이면 이름 하나 바꿀 때 화면이 깨진다. 경계는 여기다.
 *
 * 서버 전용이 아니다. 결제 시트(클라이언트)가 타입과 상수를 쓴다.
 */

/**
 * 판매 상태. 세 값이 상세 화면의 CTA를 정한다(PRD 269).
 *
 * `status`·`closes_at`·정원을 화면마다 다시 비교하지 않도록 서버에서 한 번
 * 접어서 내린다. 세 곳에서 각자 비교하면 한 곳만 규칙이 바뀌는 날이 온다.
 */
export type MeetingSale = "on_sale" | "sold_out" | "closed";

export interface MeetingDto {
  id: string;
  title: string;
  /** 시안의 눈썹 문구 — `이웃 모임 · 맛집 투어`. */
  categoryLabel: string;
  summary: string;
  description: string;
  /** 없으면 화면이 아이콘 자리표시자를 그린다. */
  imageUrl: string | null;
  address: string;
  /** 좌표는 둘 다 있을 때만 채워진다. 없으면 지도를 그리지 않는다. */
  coords: { lat: number; lng: number } | null;
  /** 1인 가격(원). */
  price: number;
  capacity: number;
  /** 1인당 최대 구매 매수. */
  maxPerPerson: number;
  seatsTaken: number;
  seatsLeft: number;
  /** 시트의 `+` 상한 — `min(남은 자리, 1인당 최대)`(PRD 283). */
  maxSelectable: number;
  /** ISO 8601. 표기는 화면에서 한다. */
  startsAt: string;
  closesAt: string;
  sale: MeetingSale;
}

/** 배너에 넘기는 최소 정보. 클라이언트 컴포넌트라 필요한 것만 건넨다. */
export interface MeetingBannerItem {
  id: string;
  title: string;
  categoryLabel: string;
  seatsLeft: number;
  startsAt: string;
  price: number;
}

export function toBannerItem(meeting: MeetingDto): MeetingBannerItem {
  return {
    id: meeting.id,
    title: meeting.title,
    categoryLabel: meeting.categoryLabel,
    seatsLeft: meeting.seatsLeft,
    startsAt: meeting.startsAt,
    price: meeting.price,
  };
}

/** 배너에 세울 최대 개수(PRD 256). */
export const MEETING_BANNER_LIMIT = 5;
```

- [ ] **Step 3: `src/lib/meetings/service.ts`**

```ts
import "server-only";

import { NotFoundError } from "@/lib/api/http";
import { createClient } from "@/lib/supabase/server";

import { MEETING_BANNER_LIMIT, type MeetingDto, type MeetingSale } from "./dto";

/**
 * 모임 상품 데이터 접근 계층.
 *
 * Supabase를 아는 코드는 여기까지다. 화면은 DTO만 받는다.
 *
 * 쓰기 함수는 없다. 상품을 만드는 것은 운영자이고 어드민 화면은 이번 범위 밖이라
 * 앱에는 읽는 경로만 있다.
 */

/**
 * `seats_taken`은 컬럼이 아니라 computed column이다. `payment`는 RLS로 자기 행만
 * 보이므로 여기서 직접 합산하면 남의 결제가 빠진 수가 나온다.
 */
const MEETING_SELECT =
  "id, title, category_label, summary, description, image_url, address, lat, lng, price, capacity, max_per_person, starts_at, closes_at, status, seats_taken";

interface MeetingRow {
  id: string;
  title: string;
  category_label: string;
  summary: string;
  description: string;
  image_url: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  price: number;
  capacity: number;
  max_per_person: number;
  starts_at: string;
  closes_at: string;
  status: string;
  seats_taken: number;
}

/**
 * 배너·목록용 모임.
 *
 * 마감된 상품과 정원이 찬 상품은 내린다(PRD 257). 배너가 없으면 화면이 영역 자체를
 * 감추므로 빈 배열을 그대로 돌려준다.
 */
export async function listMeetings(): Promise<MeetingDto[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meeting")
    .select(MEETING_SELECT)
    .eq("status", "on_sale")
    .gt("closes_at", new Date().toISOString())
    .order("display_order", { ascending: true })
    .limit(MEETING_BANNER_LIMIT);

  if (error) {
    console.error("[meetings] 목록 조회 실패", error);
    throw new Error("모임 목록을 불러오지 못했습니다.");
  }

  return ((data ?? []) as unknown as MeetingRow[])
    .map(toDto)
    // 정원이 찬 상품은 배너에서 내린다. DB에서 걸 수 없는 조건이라 여기서 한다.
    .filter((meeting) => meeting.sale === "on_sale");
}

export async function getMeeting(id: string): Promise<MeetingDto> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meeting")
    .select(MEETING_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[meetings] 상세 조회 실패", error);
    throw new Error("모임을 불러오지 못했습니다.");
  }
  if (!data) {
    throw new NotFoundError("모임을 찾을 수 없습니다.");
  }

  return toDto(data as unknown as MeetingRow);
}

function toDto(row: MeetingRow): MeetingDto {
  const seatsLeft = Math.max(0, row.capacity - row.seats_taken);

  return {
    id: row.id,
    title: row.title,
    categoryLabel: row.category_label,
    summary: row.summary,
    description: row.description,
    imageUrl: row.image_url,
    address: row.address,
    // 하나만 있는 행에 지도를 깔면 화면이 아무 데나 가리키면서 아는 척을 한다.
    coords:
      row.lat !== null && row.lng !== null
        ? { lat: row.lat, lng: row.lng }
        : null,
    price: row.price,
    capacity: row.capacity,
    maxPerPerson: row.max_per_person,
    seatsTaken: row.seats_taken,
    seatsLeft,
    maxSelectable: Math.min(seatsLeft, row.max_per_person),
    startsAt: row.starts_at,
    closesAt: row.closes_at,
    sale: saleStateOf(row, seatsLeft),
  };
}

function saleStateOf(row: MeetingRow, seatsLeft: number): MeetingSale {
  if (row.status !== "on_sale" || new Date(row.closes_at) <= new Date()) {
    return "closed";
  }
  return seatsLeft <= 0 ? "sold_out" : "on_sale";
}
```

- [ ] **Step 4: `src/components/meetings/MeetingBanner.tsx`**

design.pen `veEFZ` + `HMk1c`. 배너 자체는 120 고정 높이에 위아래로 내용을 나눠
두고(`justify-between`), 점은 상세 히어로의 점과 같은 모양(gap 5, 가운데)으로 맞춘다.

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { formatMeetingShort, formatWon } from "../../lib/meetings/format";
import type { MeetingBannerItem } from "../../lib/meetings/dto";

/** 자동 넘김 간격(PRD 256). */
const AUTO_ADVANCE_MS = 5000;

export interface MeetingBannerProps {
  meetings: MeetingBannerItem[];
}

/**
 * 메인 최상단 모임 배너 — design.pen `01b Main Page - Banner`.
 *
 * 가로 스크롤 컨테이너 + scroll-snap으로 만든다. 손가락으로 넘기는 동작을 브라우저가
 * 이미 알고 있어서 터치 이벤트를 직접 다룰 필요가 없고, 키보드 스크롤도 공짜로 온다.
 *
 * 자동 넘김은 5초 간격이며 사용자가 한 번이라도 넘기면 멈춘다(PRD 256).
 * `prefers-reduced-motion`이면 처음부터 넘기지 않는다.
 */
export function MeetingBanner({ meetings }: MeetingBannerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const multiple = meetings.length > 1;

  useEffect(() => {
    if (!multiple || !autoPlay) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const next = (Math.round(track.scrollLeft / track.clientWidth) + 1) % meetings.length;
      track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [multiple, autoPlay, meetings.length]);

  // 배너가 없으면 영역 자체를 그리지 않는다(PRD 258). 호출자도 걸러 주지만,
  // 컴포넌트 혼자 봐도 빈 자리표시자를 남기지 않는 것이 드러나야 한다.
  if (meetings.length === 0) return null;

  return (
    <section aria-label="이번 주 모임" className="flex flex-col gap-2">
      <div
        ref={trackRef}
        onScroll={(event) => {
          const track = event.currentTarget;
          setIndex(Math.round(track.scrollLeft / track.clientWidth));
        }}
        onPointerDown={() => setAutoPlay(false)}
        onKeyDown={() => setAutoPlay(false)}
        className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {meetings.map((meeting) => (
          <Slide key={meeting.id} meeting={meeting} />
        ))}
      </div>

      {multiple && (
        <div className="flex justify-center gap-[5px]" role="tablist" aria-label="모임 배너">
          {meetings.map((meeting, dot) => (
            <button
              key={meeting.id}
              type="button"
              role="tab"
              aria-selected={dot === index}
              aria-label={`${dot + 1}번째 모임`}
              onClick={() => {
                setAutoPlay(false);
                trackRef.current?.scrollTo({
                  left: dot * trackRef.current.clientWidth,
                  behavior: "smooth",
                });
              }}
              className={`h-1.5 cursor-pointer rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand ${
                dot === index ? "w-4 bg-background-brand" : "w-1.5 bg-border-default"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Slide({ meeting }: { meeting: MeetingBannerItem }) {
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="flex h-[120px] w-full shrink-0 snap-center flex-col justify-between rounded-2xl bg-background-brand p-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand md:h-[136px] md:p-4"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="type-label-md inline-flex items-center rounded-full bg-background-surface px-2 py-1 text-text-brand-strong">
          {meeting.categoryLabel.split(" · ")[0]}
        </span>
        <span className="type-label-md inline-flex items-center rounded-full bg-background-surface px-2 py-1 text-text-error">
          잔여 {meeting.seatsLeft}석
        </span>
      </span>

      <span className="flex flex-col gap-1">
        <span className="type-heading-sm truncate text-text-on-brand md:type-heading-md">
          {meeting.title}
        </span>
        <span className="type-label-md truncate text-text-on-brand md:type-body-md">
          {formatMeetingShort(meeting.startsAt)} · 1인 {formatWon(meeting.price)}
        </span>
      </span>
    </Link>
  );
}
```

시안의 태그 문구는 `이번 주 모임`이다. 상품마다 다른 문구를 하드코딩할 수는 없어
`category_label`의 앞 조각(`이웃 모임`)을 쓴다. 뒤 조각은 상세의 눈썹에서 다시 보인다.

- [ ] **Step 5: `src/app/page.tsx`에 배너를 배선한다**

`listPlaces` 옆에 `listMeetings`를 추가하고, 폰 헤더(`</header>`)와 `md` 제목 사이가
아니라 **`md` 제목 바로 다음, Featured 블록 앞**에 배너를 넣는다(시안 `PIMD0` 순서).

```tsx
// import 추가
import { MeetingBanner } from "../components/meetings/MeetingBanner";
import { toBannerItem } from "../lib/meetings/dto";
import { listMeetings } from "../lib/meetings/service";
```

```tsx
// 본문 시작 — 두 목록은 서로를 기다리지 않는다.
const [places, meetings] = await Promise.all([listPlaces(), listMeetings()]);
```

```tsx
      <h1 className="hidden type-display-sm text-text-default md:block">
        오늘 어디 갈까?
      </h1>

      {/*
        모임 배너 — design.pen `01b Main Page - Banner`. 목록 맨 위에 있고 스크롤과
        함께 밀려 올라간다(고정 아님, PRD 254). 상품이 없으면 컴포넌트가 아무것도
        그리지 않는다.
      */}
      <MeetingBanner meetings={meetings.map(toBannerItem)} />
```

- [ ] **Step 6: `activeKey`에 새 경로를 넣는다**

`src/components/layout/nav-items.ts`:

```ts
/** Which nav item a pathname belongs to. `/restaurants/…`·`/meetings/…`는 홈 밑이다. */
export function activeKey(pathname: string): string | null {
  if (
    pathname === "/" ||
    pathname.startsWith("/restaurants") ||
    pathname.startsWith("/meetings")
  ) {
    return "home";
  }
  if (pathname.startsWith("/register")) return "register";
  // 결제 완료는 흐름의 끝이고, 이어지는 곳이 마이 페이지의 결제 내역이다.
  if (pathname.startsWith("/my") || pathname.startsWith("/payments")) return "my";
  return null;
}
```

- [ ] **Step 7: 확인**

```bash
npx tsc --noEmit
npx eslint src/lib/meetings src/components/meetings src/app/page.tsx src/components/layout/nav-items.ts --max-warnings=0
npm run dev
```

브라우저 `http://localhost:3000`:
- 배너 3장이 가로로 넘어간다. 점 3개, 활성 점만 넓다.
- 5초마다 자동으로 넘어가고, 한 번 손으로 넘기면 멈춘다.
- 390 / 834 / 1280 폭에서 가로 스크롤(페이지 전체)이 생기지 않는다.
- 배너 문구가 `12/14 토 14:00 · 1인 25,000원`이다.

- [ ] **Step 8: 커밋**

```bash
git add src/lib/meetings src/components/meetings src/app/page.tsx src/components/layout/nav-items.ts
git commit -m "feat: 모임 도메인과 메인 상단 배너

시각 표기는 Asia/Seoul로 고정한다. 환불 규정이 KST 기준이라 타임존에 따라
날짜가 하루 밀리면 사용자가 다른 날에 온다.

배너는 scroll-snap 컨테이너다. 손으로 넘기는 동작과 키보드 스크롤을
브라우저가 이미 알고 있다."
```

---

### Task 5: 디자인 시스템 확장 (Badge · TabNavigation · BottomSheet/Modal · Stepper)

뒤 세 태스크가 모두 이 네 가지를 쓴다. 화면보다 먼저 만들고 스토리에서 눈으로 확인한다.

**Files:**
- Modify: `src/components/ui/Badge.tsx` (`tone` + `brand` variant)
- Modify: `src/components/ui/Navigation.tsx` (`TabNavigation`에 `variant`·`href`)
- Modify: `src/components/ui/BottomSheet.tsx` (`floating`)
- Modify: `src/components/ui/Modal.tsx` (`floating`)
- Create: `src/components/ui/Stepper.tsx`
- Modify: `src/stories/ui/Etc.stories.tsx` (Badge 매트릭스에 soft 톤·brand)
- Modify: `src/stories/ui/Navigation.stories.tsx` (inline 탭)
- Modify: `src/stories/ui/Handoff.stories.tsx` (Stepper)

**Interfaces:**
- Consumes: 없음 (DS 내부)
- Produces:
  - `Badge`: `tone?: "outline" | "soft"`(기본 `outline`), `variant`에 `"brand"` 추가
  - `TabNavigation`: `variant?: "filled" | "inline"`(기본 `filled`), `tabs: { label: string; href?: string; onClick?: () => void }[]`
  - `BottomSheet`/`Modal`: `floating?: boolean` — `fixed` 오버레이 + Esc 닫기 + 바디 스크롤 잠금
  - `Stepper`: `<Stepper value={number} max={number} min?={number} onChange={(next: number) => void} decreaseLabel={string} increaseLabel={string} />`

- [ ] **Step 1: `Badge`에 `tone`과 `brand`를 넣는다**

`src/components/ui/Badge.tsx` — `VARIANTS`를 톤별 두 벌로 나눈다. 시안의 상태 칩이
채워진 배경이고(참여 예정 = brand-subtle + text-brand) 기존 Badge는 외곽선형이다.

```tsx
import type { ReactNode } from "react";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "error"
  | "info"
  | "warning";
export type BadgeSize = "md" | "lg";
/** 외곽선형은 design.pen `Badge`, 채움형은 결제·취소 내역의 상태 칩이다. */
export type BadgeTone = "outline" | "soft";

/** 외곽선 + 라벨 색. design.pen `Badge`. */
const OUTLINE: Record<BadgeVariant, string> = {
  neutral: "border-border-strong text-text-default bg-background-surface",
  brand: "border-border-brand text-text-brand bg-background-surface",
  success: "border-border-success text-text-success bg-background-surface",
  error: "border-border-error text-text-error bg-background-surface",
  info: "border-border-info text-text-info bg-background-surface",
  warning: "border-border-warning text-text-warning bg-background-surface",
};

/**
 * 채움 + 라벨 색. 테두리는 없다.
 *
 * `brand`는 design.pen의 Badge 세트에는 없지만 결제 내역의 `참여 예정` 칩이 이
 * 조합(brand-subtle + text-brand)이다. 외곽선형도 같은 규칙으로 함께 채워 둔다.
 */
const SOFT: Record<BadgeVariant, string> = {
  neutral: "border-transparent bg-background-subtle text-text-muted",
  brand: "border-transparent bg-background-brand-subtle text-text-brand",
  success: "border-transparent bg-background-success text-text-success",
  error: "border-transparent bg-background-error text-text-error",
  info: "border-transparent bg-background-info text-text-info",
  warning: "border-transparent bg-background-warning text-text-warning",
};

/** md는 실측, lg는 13-ds-ui-component-etc.txt(24 높이, 8 패딩). */
const SIZES = {
  md: { height: 20, radius: 10, paddingX: 8 },
  lg: { height: 24, radius: 12, paddingX: 8 },
} satisfies Record<BadgeSize, { height: number; radius: number; paddingX: number }>;

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({
  variant = "neutral",
  size = "md",
  tone = "outline",
  children,
  className,
}: BadgeProps) {
  const spec = SIZES[size];
  const colours = tone === "soft" ? SOFT[variant] : OUTLINE[variant];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border type-label-md ${colours} ${className ?? ""}`}
      style={{
        height: spec.height,
        borderRadius: spec.radius,
        paddingInline: spec.paddingX,
      }}
    >
      {children}
    </span>
  );
}
```

기존 호출부는 `tone` 기본값이 `outline`이라 그대로 동작한다. 배경 클래스가
`VARIANTS`에서 톤 표로 옮겨 갔으므로 컴포넌트 본문의 `bg-background-surface`는 지운다.

- [ ] **Step 2: `TabNavigation`에 `variant`와 `href`를 넣는다**

`src/components/ui/Navigation.tsx`의 `TabNavigation`만 교체한다.

```tsx
/* ── TabNavigation ─────────────────────────────────────────────────────── */

export interface TabNavigationTab {
  label: string;
  /** 서버에서 탭을 바꿀 때. 있으면 링크로 렌더한다. */
  href?: string;
  onClick?: () => void;
}

/**
 * `filled`은 design.pen `TabNavigation`(48px 등분, 표면 배경).
 * `inline`은 마이 페이지의 밑줄 탭(내용 폭, 배경 없음, 24 간격).
 */
export type TabNavigationVariant = "filled" | "inline";

export interface TabNavigationProps {
  /** 2개 이상. */
  tabs: TabNavigationTab[];
  value?: number;
  variant?: TabNavigationVariant;
  className?: string;
}

export function TabNavigation({
  tabs,
  value = 0,
  variant = "filled",
  className,
}: TabNavigationProps) {
  const inline = variant === "inline";

  return (
    <div
      role="tablist"
      className={[
        "flex w-full border-b border-border-default",
        inline ? "gap-24" : "bg-background-surface",
        className ?? "",
      ].join(" ")}
      style={inline ? undefined : { height: 48 }}
    >
      {tabs.map((tab, index) => {
        const selected = index === value;
        const shared = [
          "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-brand",
          selected ? "text-text-brand" : "text-text-muted",
        ];

        // 밑줄은 탭의 아래 테두리다. `-mb-px`로 탭 줄의 1px 선 위에 겹쳐 놓아야
        // 2px 브랜드 선과 1px 기본 선이 3px로 쌓이지 않는다.
        const content = inline ? (
          <span className="type-label-lg">{tab.label}</span>
        ) : (
          <>
            <span className="type-label-lg flex flex-1 items-center justify-center px-4">
              {tab.label}
            </span>
            <span
              aria-hidden
              className={selected ? "bg-background-brand" : "bg-transparent"}
              style={{ height: 2 }}
            />
          </>
        );

        const classes = [
          ...shared,
          inline
            ? `-mb-px border-b-2 pb-2 ${selected ? "border-background-brand" : "border-transparent"}`
            : "flex flex-1 flex-col",
        ].join(" ");

        if (tab.href) {
          return (
            <Link
              key={tab.label}
              href={tab.href}
              role="tab"
              aria-selected={selected}
              className={classes}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={tab.onClick}
            className={classes}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
```

파일 맨 위에 `import Link from "next/link";`를 추가한다. `ReactNode` import가 더 이상
쓰이지 않으면 지운다(린트가 잡는다).

- [ ] **Step 3: `BottomSheet`에 `floating`을 넣는다**

`src/components/ui/BottomSheet.tsx`를 통째로 교체한다.

```tsx
"use client";

import { useEffect, type ReactNode } from "react";

const SCRIM = "#17131966";

export interface BottomSheetProps {
  title?: string;
  children?: ReactNode;
  /** 스크림을 누르면 아무것도 고르지 않고 닫힌다. */
  onClose?: () => void;
  /**
   * 화면 전체를 덮는 오버레이로 띄운다. Esc로 닫히고 뒤 화면 스크롤이 잠긴다.
   * 끄면(기본) 흐름 안에서 그대로 렌더된다 — 스토리에서 쓰는 모양이다.
   */
  floating?: boolean;
  className?: string;
}

/** BottomSheet — design.pen `BottomSheet`. 폭 전체, 높이는 내용에 맞춘다. */
export function BottomSheet({
  title,
  children,
  onClose,
  floating = false,
  className,
}: BottomSheetProps) {
  useEffect(() => {
    if (!floating) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);

    // 시트 뒤 화면이 같이 움직이면 어디를 만지는지 알 수 없다.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [floating, onClose]);

  return (
    <div
      className={
        floating
          ? // md부터는 아래에 붙는 시트가 아니라 가운데 다이얼로그로 올라온다.
            "fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-24"
          : "flex flex-col justify-end"
      }
      style={{ backgroundColor: SCRIM }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`flex w-full flex-col gap-3.5 rounded-t-2xl bg-background-surface px-4 pt-2.5 pb-5 ${
          floating ? "md:max-w-[480px] md:rounded-2xl" : ""
        } ${className ?? ""}`}
      >
        <div className="flex justify-center pb-1" aria-hidden>
          <span
            className="rounded-sm bg-border-strong"
            style={{ width: 36, height: 4 }}
          />
        </div>
        {title && <h2 className="type-heading-sm text-text-default">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export interface BottomSheetOptionProps {
  children: ReactNode;
  onClick?: () => void;
}

/** 시트 안의 44px 한 줄. */
export function BottomSheetOption({
  children,
  onClick,
}: BottomSheetOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="type-body-lg flex w-full cursor-pointer items-center px-1 text-left text-text-default focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-brand"
      style={{ height: 44 }}
    >
      {children}
    </button>
  );
}
```

인라인 `borderRadius: "16px 16px 0 0"`을 `rounded-t-2xl`로 바꿨다. 인라인 스타일은
`md:rounded-2xl`이 이길 수 없다.

- [ ] **Step 4: `Modal`에 `floating`을 넣는다**

`src/components/ui/Modal.tsx` 상단에 `"use client";`와 `useEffect` import를 넣고,
`BottomSheet`와 같은 효과 훅을 추가한 뒤 감싸는 div만 바꾼다.

```tsx
"use client";

import { useEffect, type ReactNode } from "react";

import { Icon } from "../foundation/Icon";

const SCRIM = "#17131966";
const MODAL_SHADOW = "0 12px 32px #1713194D";

export interface ModalProps {
  title: string;
  children?: ReactNode;
  /** 보조 버튼 하나와 주 버튼 하나, 그 순서로. */
  actions?: ReactNode;
  onClose?: () => void;
  /** 화면 전체를 덮는 오버레이로 띄운다. Esc로 닫히고 뒤 화면 스크롤이 잠긴다. */
  floating?: boolean;
  className?: string;
}
```

```tsx
export function Modal({
  title,
  children,
  actions,
  onClose,
  floating = false,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!floating) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [floating, onClose]);

  return (
    <div
      className={`flex items-center justify-center p-6 ${floating ? "fixed inset-0 z-50" : ""}`}
      style={{ backgroundColor: SCRIM }}
      onClick={onClose}
    >
      {/* 이하 기존 본문 그대로 */}
```

기존 본문의 `w-[320px]`은 시안 모달 폭 312 + 좌우 24 여백과 맞으므로 건드리지 않는다.

- [ ] **Step 5: `src/components/ui/Stepper.tsx`를 만든다**

design.pen `OQqXe` 안 `u8T6Iw`. 32px 정사각 두 개와 숫자, 간격 14.

```tsx
"use client";

/**
 * 수량 스테퍼 — design.pen `06b Payment Bottom Sheet`의 인원 선택.
 *
 * 기존 컴포넌트로 표현할 수 없어 새로 만들었다. `−`/`+`는 아이콘 세트에 minus가
 * 없어 시안대로 글리프를 쓴다.
 *
 * 상한에 닿으면 `+`를 비활성한다(PRD 284). 안내 문구는 시트가 띄운다 — 스테퍼는
 * 자기 상한만 알고 왜 그런지는 모른다.
 */
export interface StepperProps {
  value: number;
  /** 상한. `min(남은 자리, 1인당 최대)`를 시트가 계산해 넘긴다. */
  max: number;
  min?: number;
  onChange: (next: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}

export function Stepper({
  value,
  max,
  min = 1,
  onChange,
  decreaseLabel,
  increaseLabel,
}: StepperProps) {
  return (
    <div className="flex items-center gap-3.5">
      <StepButton
        label={decreaseLabel}
        glyph="−"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      />
      <span
        aria-live="polite"
        className="type-heading-md min-w-[16px] text-center text-text-default"
      >
        {value}
      </span>
      <StepButton
        label={increaseLabel}
        glyph="+"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      />
    </div>
  );
}

function StepButton({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "type-heading-md flex size-8 items-center justify-center rounded-lg border",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand",
        disabled
          ? "cursor-not-allowed border-border-default text-text-subtle"
          : "cursor-pointer border-border-strong text-text-default",
      ].join(" ")}
    >
      {glyph}
    </button>
  );
}
```

- [ ] **Step 6: 스토리를 갱신한다**

`src/stories/ui/Etc.stories.tsx`의 Badge 스토리에 채움 톤 줄을 추가한다(기존 매트릭스
헬퍼를 그대로 쓴다). 여섯 variant × 두 톤이 한눈에 보여야 한다.

```tsx
export const BadgeTones: Story = {
  name: "Badge · 톤",
  render: () => (
    <Gallery>
      {(["outline", "soft"] as const).map((tone) => (
        <Specimen key={tone} label={tone}>
          <div className="flex flex-wrap items-center gap-2">
            {(["neutral", "brand", "success", "error", "info", "warning"] as const).map(
              (variant) => (
                <Badge key={variant} variant={variant} tone={tone} size="lg">
                  {variant}
                </Badge>
              ),
            )}
          </div>
        </Specimen>
      ))}
    </Gallery>
  ),
};
```

`src/stories/ui/Navigation.stories.tsx`에 밑줄 탭을 추가한다.

```tsx
export const TabsInline: Story = {
  name: "TabNavigation · inline",
  render: () => (
    <div className="w-[360px] bg-background-canvas p-4">
      <TabNavigation
        variant="inline"
        value={1}
        tabs={[{ label: "내가 쓴 글" }, { label: "결제 내역" }, { label: "취소 내역" }]}
      />
    </div>
  ),
};
```

`src/stories/ui/Handoff.stories.tsx`에 Stepper를 추가한다. 스토리는 서버에서 렌더되지
않으므로 상태를 들고 있어도 된다.

```tsx
export const StepperSpecimen: Story = {
  name: "Stepper",
  render: () => {
    const Demo = () => {
      const [count, setCount] = useState(2);
      return (
        <Gallery>
          <Specimen label="상한 4 (남은 자리 8, 1인당 4매)">
            <Stepper
              value={count}
              max={4}
              onChange={setCount}
              decreaseLabel="인원 줄이기"
              increaseLabel="인원 늘리기"
            />
          </Specimen>
          <Specimen label="상한에 닿음">
            <Stepper
              value={4}
              max={4}
              onChange={() => {}}
              decreaseLabel="인원 줄이기"
              increaseLabel="인원 늘리기"
            />
          </Specimen>
        </Gallery>
      );
    };
    return <Demo />;
  },
};
```

`import { useState } from "react";`와 `import { Stepper } from "../../components/ui/Stepper";`를
해당 스토리 파일 상단에 추가한다.

- [ ] **Step 7: 확인**

```bash
npx tsc --noEmit
npx eslint src/components/ui src/stories --max-warnings=0
npm run storybook
```

Storybook에서:
- Badge 두 톤 × 여섯 variant가 모두 보이고, `soft`는 테두리가 없다.
- inline 탭의 활성 밑줄이 2px이고 아래 1px 선과 겹쳐 3px로 쌓이지 않는다.
- Stepper 상한에서 `+`가 흐려지고 눌리지 않는다.
- 기존 BottomSheet·Modal 스토리가 그대로 보인다(`floating` 없이).

- [ ] **Step 8: 커밋**

```bash
git add src/components/ui/Badge.tsx src/components/ui/Navigation.tsx \
        src/components/ui/BottomSheet.tsx src/components/ui/Modal.tsx \
        src/components/ui/Stepper.tsx src/stories/ui
git commit -m "feat: 결제 화면이 필요한 DS 확장

Badge에 채움 톤과 brand, TabNavigation에 밑줄 변형과 링크 탭, 시트·모달에
오버레이 모드, 신규 Stepper. 스토리도 같이 갱신했다.

시트의 radius를 인라인 스타일에서 클래스로 옮겼다. md에서 가운데
다이얼로그로 올라갈 때 인라인 값은 이길 수 없다."
```

---

### Task 6: 모임 상세 화면

**Files:**
- Create: `src/components/meetings/RefundPolicyTable.tsx`
- Create: `src/components/meetings/MeetingInfoCard.tsx`
- Create: `src/lib/payments/service.ts` (이 태스크에서는 읽기 하나만)
- Create: `src/app/meetings/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `REFUND_RULES`·`REFUND_BASIS_NOTE`, Task 4의 `getMeeting`·포맷터, 기존 `FlowTopBar`·`PageContainer`·`AppShell`·`NaverMap`·`Button`·`ButtonLink`
- Produces:
  - `<RefundPolicyTable className?={string} />`
  - `<MeetingInfoCard meeting={MeetingDto} />`
  - `findPaidPaymentId(meetingId: string, userId: string): Promise<string | null>` — 이미 결제한 건의 id
  - 라우트 `/meetings/[id]`

- [ ] **Step 1: `src/components/meetings/RefundPolicyTable.tsx`**

```tsx
import {
  REFUND_RULES,
  type RefundRuleKey,
} from "../../lib/payments/refund";

/** 시안이 100%는 초록, 50%는 기본, 환불 불가는 빨강으로 쓴다. */
const REFUND_TONE: Record<RefundRuleKey, string> = {
  over_7d: "text-text-success",
  between_3_7d: "text-text-default",
  within_3d: "text-text-error",
};

/**
 * 환불 규정 표 — design.pen `06 Meeting Detail`의 `rf-table`.
 *
 * 표 내용은 `refund.ts`에서 온다. 상세·결제 완료 화면이 같은 표를 쓰고, 규정이
 * 바뀌면 두 화면과 판정 코드가 함께 바뀐다.
 *
 * 진짜 `<table>`로 쓴다. 두 열이 서로 대응하는 표라 스크린 리더가 "취소 시점"과
 * "환불"을 짝지어 읽어야 한다.
 */
export function RefundPolicyTable({ className }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border-default bg-background-surface ${className ?? ""}`}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-background-subtle">
            <th className="type-label-lg px-3.5 py-2.5 text-left text-text-default">
              취소 시점
            </th>
            <th className="type-label-lg px-3.5 py-2.5 text-right text-text-default">
              환불
            </th>
          </tr>
        </thead>
        <tbody>
          {REFUND_RULES.map((rule, index) => (
            <tr
              key={rule.key}
              className={index === 0 ? "border-t border-border-default" : undefined}
            >
              <td className="type-body-md px-3.5 py-2.5 text-text-muted">
                {rule.period}
              </td>
              <td
                className={`type-label-lg px-3.5 py-2.5 text-right ${REFUND_TONE[rule.key]}`}
              >
                {rule.refund}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: `src/components/meetings/MeetingInfoCard.tsx`**

```tsx
import type { ReactNode } from "react";

import { NaverMap } from "../ui/NaverMap";
import { NAVER_MAP_CLIENT_ID } from "../../lib/maps/env";
import type { MeetingDto } from "../../lib/meetings/dto";
import {
  formatMeetingDateTime,
  formatMeetingDeadline,
  formatWon,
} from "../../lib/meetings/format";

/**
 * 일시·장소·지도·가격·정원·마감 — design.pen `06 Meeting Detail`의 `Info Card`.
 *
 * 지도는 좌표가 있을 때만 그린다. 주소만 있는 상품에 지도를 깔면 화면이 아무 데나
 * 가리키면서 아는 척을 한다(맛집 상세와 같은 규칙).
 *
 * 지도 높이는 시안이 120이지만 `NaverMap` 의 `sm`(150)을 그대로 쓴다. 임의값
 * 클래스로 덮으면 Tailwind가 두 `h-[…]` 중 어느 것을 뒤에 놓을지 보장하지 않아
 * 조용히 어긋난다. 앱의 다른 미니 지도와 높이가 같아지는 편이 낫다.
 */
export function MeetingInfoCard({ meeting }: { meeting: MeetingDto }) {
  return (
    <section
      aria-label="모임 정보"
      className="flex flex-col gap-3 rounded-2xl border border-border-default bg-background-surface p-4"
    >
      <Row label="일시">{formatMeetingDateTime(meeting.startsAt)}</Row>
      <Row label="장소">{meeting.address}</Row>

      {meeting.coords && (
        <NaverMap
          label={meeting.address}
          clientId={NAVER_MAP_CLIENT_ID}
          center={meeting.coords}
          variant="static"
          size="sm"
          className="rounded-xl"
        />
      )}

      <span aria-hidden className="h-px w-full bg-border-default" />

      <Row label="1인 가격">{formatWon(meeting.price)}</Row>
      <Row label="참여 인원" tone="text-text-brand">
        {`${meeting.seatsTaken}명 / 최대 ${meeting.capacity}명 · 남은 ${meeting.seatsLeft}석`}
      </Row>
      <Row label="모집 마감">{formatMeetingDeadline(meeting.closesAt)}</Row>
    </section>
  );
}

function Row({
  label,
  tone = "text-text-default",
  children,
}: {
  label: string;
  tone?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="type-label-md shrink-0 text-text-muted">{label}</span>
      <span className={`type-label-lg text-right ${tone}`}>{children}</span>
    </div>
  );
}
```

- [ ] **Step 3: `src/lib/payments/service.ts` (읽기 하나)**

```ts
import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * 결제 데이터 접근 계층.
 *
 * Supabase를 아는 코드는 여기까지다. 화면은 DTO만 받는다.
 *
 * RLS가 자기 행만 보여 주므로 `user_id` 조건은 방어용이다. 정책이 느슨해지는 날
 * 조용히 남의 결제를 세지 않도록 읽는 쪽 코드에도 조건을 남긴다.
 */

/**
 * 이 사용자가 이 모임을 이미 결제했는지. 결제한 건의 id, 없으면 null.
 *
 * 상세 화면의 CTA가 `결제 내역 보기`로 바뀌는 조건이다(PRD 275). DB에도 같은
 * 사실이 `(user_id, meeting_id) where status='paid'` 유니크 인덱스로 들어 있다.
 */
export async function findPaidPaymentId(
  meetingId: string,
  userId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment")
    .select("id")
    .eq("meeting_id", meetingId)
    .eq("user_id", userId)
    .eq("status", "paid")
    .maybeSingle();

  if (error) {
    console.error("[payments] 결제 여부 조회 실패", error);
    throw new Error("결제 정보를 불러오지 못했습니다.");
  }

  return data?.id ?? null;
}
```

- [ ] **Step 4: `src/app/meetings/[id]/page.tsx`**

```tsx
import Image from "next/image";
import { notFound } from "next/navigation";

import { Icon } from "../../../components/foundation/Icon";
import { AppShell } from "../../../components/layout/AppShell";
import { FlowTopBar } from "../../../components/layout/FlowTopBar";
import { PageContainer } from "../../../components/layout/PageContainer";
import { MeetingInfoCard } from "../../../components/meetings/MeetingInfoCard";
import { RefundPolicyTable } from "../../../components/meetings/RefundPolicyTable";
import { Button } from "../../../components/ui/Button";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { NotFoundError } from "../../../lib/api/http";
import { getCurrentUser } from "../../../lib/auth/session";
import type { MeetingDto } from "../../../lib/meetings/dto";
import { formatWon } from "../../../lib/meetings/format";
import { getMeeting } from "../../../lib/meetings/service";
import { REFUND_BASIS_NOTE } from "../../../lib/payments/refund";
import { findPaidPaymentId } from "../../../lib/payments/service";

/**
 * 모임 상세 — design.pen `06 Meeting Detail`.
 *
 * 비로그인도 전체를 볼 수 있다(PRD 276). 로그인은 `결제하기`를 누를 때만 요구하고,
 * 돌아올 곳으로 `?pay=1`이 붙은 이 화면을 넘긴다. 시트의 열림 상태가 URL에 있어서
 * 로그인 왕복 뒤에도 사용자가 방금 누른 버튼을 다시 찾을 필요가 없다.
 *
 * 읽는 화면이라 본문 폭은 800에서 멈춘다. 결제 바는 모든 폭에서 화면 하단에
 * 고정된다 — 결제 CTA는 상시 보여야 하고(PRD 268), 폭에 따라 자리가 옮겨 다니면
 * 같은 흐름이 화면마다 달라 보인다.
 */
export default async function MeetingDetailPage(
  props: PageProps<"/meetings/[id]">,
) {
  const { id } = await props.params;

  const viewer = await getCurrentUser();
  const meeting = await loadMeeting(id);
  const paidId = viewer ? await findPaidPaymentId(meeting.id, viewer.id) : null;

  return (
    <AppShell tabBar={false}>
      <FlowTopBar backHref="/" title="모임 상세" />

      <PageContainer
        as="main"
        width="article"
        // 하단 고정 바(80) + iOS 홈 인디케이터만큼 마지막 줄을 비운다.
        className="flex flex-col gap-4 py-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:py-32"
      >
        {/* 히어로 — 상품 이미지 한 장. 여러 장은 이번 범위 밖이라 점은 그리지 않는다. */}
        {meeting.imageUrl ? (
          <div className="relative aspect-[36/23] w-full overflow-hidden rounded-2xl md:aspect-[21/9]">
            <Image
              src={meeting.imageUrl}
              alt=""
              fill
              sizes="(min-width: 800px) 800px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        ) : (
          <div
            className="flex aspect-[36/23] w-full items-center justify-center rounded-2xl bg-background-brand-subtle text-text-subtle md:aspect-[21/9]"
            aria-hidden
          >
            <Icon name="image" size={32} />
          </div>
        )}

        <header className="flex flex-col gap-1.5">
          <span className="type-label-md text-text-brand">
            {meeting.categoryLabel}
          </span>
          <h1 className="type-heading-lg text-text-default md:type-display-sm">
            {meeting.title}
          </h1>
          <p className="type-body-md text-text-muted md:type-body-lg">
            {meeting.summary}
          </p>
        </header>

        <MeetingInfoCard meeting={meeting} />

        <section aria-labelledby="meeting-desc" className="flex flex-col gap-2">
          <h2 id="meeting-desc" className="type-heading-sm text-text-default">
            모임 소개
          </h2>
          <p className="type-body-md whitespace-pre-line text-text-muted md:type-body-lg">
            {meeting.description}
          </p>
        </section>

        <section aria-labelledby="meeting-refund" className="flex flex-col gap-2">
          <h2 id="meeting-refund" className="type-heading-sm text-text-default">
            환불 규정
          </h2>
          <RefundPolicyTable />
          <p className="type-label-md text-text-subtle">{REFUND_BASIS_NOTE}</p>
        </section>
      </PageContainer>

      {/* 결제 바 — 시안 `Pay Bar`. 폭이 커져도 본문과 같은 800 안에서 정렬된다. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-default bg-background-surface pb-[env(safe-area-inset-bottom)]">
        <PageContainer
          width="article"
          className="flex items-center justify-between gap-3 py-4"
        >
          <span className="flex flex-col">
            <span className="type-label-md text-text-muted">1인</span>
            <span className="type-heading-md text-text-default">
              {formatWon(meeting.price)}
            </span>
          </span>
          <PayAction meeting={meeting} signedIn={Boolean(viewer)} paid={Boolean(paidId)} />
        </PageContainer>
      </div>
    </AppShell>
  );
}

/**
 * 상태별 CTA — PRD 269의 표 그대로.
 *
 * 비활성 버튼은 `Button`(누를 수 없는 링크를 만들지 않는다), 이동하는 것은
 * `ButtonLink`다.
 */
function PayAction({
  meeting,
  signedIn,
  paid,
}: {
  meeting: MeetingDto;
  signedIn: boolean;
  paid: boolean;
}) {
  if (paid) {
    return (
      <ButtonLink href="/my?tab=payments" variant="secondary" size="lg">
        결제 내역 보기
      </ButtonLink>
    );
  }
  if (meeting.sale === "closed") {
    return (
      <Button size="lg" disabled>
        모집 종료
      </Button>
    );
  }
  if (meeting.sale === "sold_out") {
    return (
      <Button size="lg" disabled>
        정원 마감
      </Button>
    );
  }

  const sheetHref = `/meetings/${meeting.id}?pay=1`;

  return (
    <ButtonLink
      href={
        signedIn ? sheetHref : `/login?next=${encodeURIComponent(sheetHref)}`
      }
      size="lg"
      scroll={false}
    >
      결제하기
    </ButtonLink>
  );
}

/** 없는 모임과 잘못된 id는 똑같이 404다. 던지면 500이 되고 "고장난 페이지"가 된다. */
async function loadMeeting(id: string): Promise<MeetingDto> {
  try {
    return await getMeeting(id);
  } catch (reason) {
    if (reason instanceof NotFoundError) {
      notFound();
    }
    throw reason;
  }
}
```

- [ ] **Step 5: 확인**

```bash
npx tsc --noEmit
npx eslint src/app/meetings src/components/meetings src/lib/payments --max-warnings=0
npm run dev
```

브라우저에서 메인 배너를 눌러 상세로 들어간다:
- 히어로 · 눈썹 · 제목 · 한 줄 소개가 시안 순서대로 있다.
- 정보 카드에 `12월 14일 (토) 오후 2:00`, `서울 구로구 디지털로 300`, 지도, `25,000원`,
  `0명 / 최대 20명 · 남은 20석`, `12월 13일 (금) 23:59`.
- 환불 규정 표 4줄(머리 + 3), 100%는 초록 · 환불 불가는 빨강, 아래 각주.
- 하단 결제 바가 스크롤과 무관하게 붙어 있고 마지막 문단을 가리지 않는다.
- 이미지 없는 모임(사진 클래스)은 아이콘 자리표시자가 보인다.
- 로그아웃 상태에서 `결제하기`를 누르면 `/login?next=/meetings/…%3Fpay%3D1`로 간다.
- 390 / 834 / 1280 폭에서 가로 스크롤 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/app/meetings src/components/meetings/MeetingInfoCard.tsx \
        src/components/meetings/RefundPolicyTable.tsx src/lib/payments/service.ts
git commit -m "feat: 모임 상세 화면

CTA는 판매 상태와 로그인 여부, 이미 결제했는지로 갈린다. 비활성 상태는
Button으로 둔다 — 누를 수 없는 링크를 만들지 않는다.

환불 규정 표는 refund.ts에서 내용을 가져온다. 규정이 바뀌면 화면과 판정이
함께 바뀐다."
```

---

### Task 7: 결제 시트와 결제 완료 화면

**Files:**
- Create: `src/components/ui/DetailRow.tsx` (라벨-값 한 줄, 세 화면 공용)
- Modify: `src/components/meetings/MeetingInfoCard.tsx` (지역 `Row` 삭제 → `DetailRow` 사용)
- Modify: `src/stories/ui/Handoff.stories.tsx` (DetailRow 스토리)
- Create: `src/lib/payments/dto.ts`
- Modify: `src/lib/payments/service.ts` (`createPayment`, `getPaymentByOrderNo`, `PaymentError`)
- Create: `src/lib/payments/actions.ts`
- Create: `src/components/meetings/MeetingPaySheet.tsx`
- Create: `src/app/payments/[orderNo]/page.tsx`
- Modify: `src/app/meetings/[id]/page.tsx` (`?pay=1`이면 시트 렌더)
- Modify: `src/lib/supabase/proxy.ts` (`PROTECTED_PREFIXES`에 `/payments`)

**Interfaces:**
- Consumes: Task 3의 `pay_meeting` RPC, Task 4의 포맷터·`getMeeting`, Task 5의 `Stepper`·`BottomSheet(floating)`, 기존 `Checkbox`·`Button`·`ButtonLink`
- Produces:
  - `<DetailRow label={string} tone?={string}>{value}</DetailRow>`
  - `interface PaymentDto { id: string; orderNo: string; headcount: number; amount: number; method: string; status: "paid" | "canceled"; paidAt: string; canceledAt: string | null; refundAmount: number | null; refundRate: number | null; refundRule: RefundRuleKey | null; refundCompletesAt: string | null; meeting: { id: string; title: string; startsAt: string; address: string; imageUrl: string | null } }`
  - `createPayment(meetingId: string, headcount: number): Promise<string>` — 주문번호
  - `getPaymentByOrderNo(orderNo: string, userId: string): Promise<PaymentDto>`
  - `class PaymentError extends Error { code: PaymentErrorCode }`
  - `payMeeting(prev: PayFormState, formData: FormData): Promise<PayFormState>`, `interface PayFormState { error?: string }`
  - 라우트 `/payments/[orderNo]`

- [ ] **Step 1: `src/components/ui/DetailRow.tsx` + 스토리**

```tsx
import type { ReactNode } from "react";

export interface DetailRowProps {
  label: string;
  /** 값의 색 유틸리티. 기본은 본문색. */
  tone?: string;
  children: ReactNode;
}

/**
 * 라벨-값 한 줄 — design.pen의 모임 정보 카드 · 결제 완료 카드 · 취소 모달이 모두
 * 같은 줄을 쓴다. 라벨은 왼쪽 12px 흐린 글씨, 값은 오른쪽 14px 강조 글씨다.
 *
 * 세 화면이 각자 flex 줄을 들고 있으면 한 곳만 간격이 바뀌는 날이 온다.
 */
export function DetailRow({ label, tone = "text-text-default", children }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="type-label-md shrink-0 text-text-muted">{label}</span>
      <span className={`type-label-lg text-right ${tone}`}>{children}</span>
    </div>
  );
}
```

`MeetingInfoCard.tsx`에서 지역 `Row` 함수를 지우고 `DetailRow`를 import해 `<Row …>`
호출을 `<DetailRow …>`로 바꾼다. `ReactNode` import가 남으면 지운다.

`src/stories/ui/Handoff.stories.tsx`에 스토리를 추가한다.

```tsx
export const DetailRows: Story = {
  name: "DetailRow",
  render: () => (
    <Gallery>
      <Specimen label="기본 / 강조">
        <div className="flex w-[296px] flex-col gap-3">
          <DetailRow label="결제 금액">50,000원</DetailRow>
          <DetailRow label="참여 인원" tone="text-text-brand">
            12명 / 최대 20명 · 남은 8석
          </DetailRow>
        </div>
      </Specimen>
    </Gallery>
  ),
};
```

- [ ] **Step 2: `src/lib/payments/dto.ts`**

```ts
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
```

- [ ] **Step 3: `src/lib/payments/service.ts`에 결제 쓰기·조회를 더한다**

기존 `findPaidPaymentId` 아래에 붙인다.

```ts
import { NotFoundError } from "@/lib/api/http";

import type { PaymentDto } from "./dto";
import type { RefundRuleKey } from "./refund";

/** `pay_meeting`·`cancel_payment`가 던지는 사유. */
export type PaymentErrorCode =
  | "AUTH_REQUIRED"
  | "NOT_FOUND"
  | "CLOSED"
  | "HEADCOUNT"
  | "ALREADY_PAID"
  | "SOLD_OUT"
  | "ALREADY_CANCELED"
  | "NO_REFUND"
  | "BAD_REFUND"
  | "UNKNOWN";

/** 사유 코드를 들고 다니는 예외. 화면 문구는 서버 액션이 붙인다. */
export class PaymentError extends Error {
  constructor(
    readonly code: PaymentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

const KNOWN_CODES: PaymentErrorCode[] = [
  "AUTH_REQUIRED",
  "NOT_FOUND",
  "CLOSED",
  "HEADCOUNT",
  "ALREADY_PAID",
  "SOLD_OUT",
  "ALREADY_CANCELED",
  "NO_REFUND",
  "BAD_REFUND",
];

/**
 * Postgres 예외를 코드로 옮긴다.
 *
 * 함수는 `raise exception 'SOLD_OUT'`처럼 사유 한 단어만 던진다. 유니크 인덱스에
 * 걸린 경우(23505)는 같은 사람이 같은 모임을 두 번 결제한 것이므로 ALREADY_PAID와
 * 같은 사실이다 — 함수의 exists 검사와 인덱스 사이의 경합에서만 나온다.
 */
function toPaymentError(error: { message?: string; code?: string }): PaymentError {
  if (error.code === "23505") {
    return new PaymentError("ALREADY_PAID", "이미 결제한 모임입니다.");
  }
  const found = KNOWN_CODES.find((code) => error.message?.includes(code));
  return new PaymentError(found ?? "UNKNOWN", error.message ?? "결제에 실패했습니다.");
}

/**
 * 결제한다. 주문번호를 돌려준다.
 *
 * 정원 검사와 총액 계산은 `pay_meeting`이 트랜잭션 안에서 한다. 여기서 금액을
 * 계산해 넘기지 않는다 — 화면에 보인 금액과 청구액이 어긋날 방법을 남기지 않는다.
 */
export async function createPayment(
  meetingId: string,
  headcount: number,
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("pay_meeting", {
    p_meeting_id: meetingId,
    p_headcount: headcount,
  });

  if (error) {
    console.error("[payments] 결제 실패", error);
    throw toPaymentError(error);
  }
  if (typeof data !== "string" || data.length === 0) {
    throw new PaymentError("UNKNOWN", "결제 결과를 확인하지 못했습니다.");
  }

  return data;
}

const PAYMENT_SELECT =
  "id, order_no, headcount, amount, method, status, paid_at, canceled_at, refund_amount, refund_rate, refund_rule, refund_completes_at, meeting(id, title, starts_at, address, image_url)";

interface PaymentRow {
  id: string;
  order_no: string;
  headcount: number;
  amount: number;
  method: string;
  status: string;
  paid_at: string;
  canceled_at: string | null;
  refund_amount: number | null;
  refund_rate: number | null;
  refund_rule: string | null;
  refund_completes_at: string | null;
  meeting: {
    id: string;
    title: string;
    starts_at: string;
    address: string;
    image_url: string | null;
  } | null;
}

function toPaymentDto(row: PaymentRow): PaymentDto {
  if (!row.meeting) {
    // 모임 참조는 NOT NULL이고 삭제 경로가 없다. 여기 오면 스키마가 바뀐 것이다.
    throw new Error("결제에 연결된 모임이 없습니다.");
  }

  return {
    id: row.id,
    orderNo: row.order_no,
    headcount: row.headcount,
    amount: row.amount,
    method: row.method,
    status: row.status === "canceled" ? "canceled" : "paid",
    paidAt: row.paid_at,
    canceledAt: row.canceled_at,
    refundAmount: row.refund_amount,
    refundRate: row.refund_rate,
    refundRule: (row.refund_rule as RefundRuleKey | null) ?? null,
    refundCompletesAt: row.refund_completes_at,
    meeting: {
      id: row.meeting.id,
      title: row.meeting.title,
      startsAt: row.meeting.starts_at,
      address: row.meeting.address,
      imageUrl: row.meeting.image_url,
    },
  };
}

/**
 * 주문번호로 한 건.
 *
 * 남의 주문번호를 넣으면 RLS가 걸러 `NotFoundError`가 된다. "권한 없음"과 "없는
 * 주문"을 구분해 알려 주면 주문번호의 존재 여부가 샌다.
 */
export async function getPaymentByOrderNo(
  orderNo: string,
  userId: string,
): Promise<PaymentDto> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment")
    .select(PAYMENT_SELECT)
    .eq("order_no", orderNo)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[payments] 주문 조회 실패", error);
    throw new Error("결제 정보를 불러오지 못했습니다.");
  }
  if (!data) {
    throw new NotFoundError("결제 내역을 찾을 수 없습니다.");
  }

  return toPaymentDto(data as unknown as PaymentRow);
}
```

- [ ] **Step 4: `src/lib/payments/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/session";

import { createPayment, PaymentError, type PaymentErrorCode } from "./service";

/**
 * 결제·취소 서버 액션.
 *
 * 변경은 Route Handler가 아니라 액션으로 한다. 화면이 폼 하나로 끝나고, Next.js가
 * CSRF 토큰을 붙여 준다.
 */

export interface PayFormState {
  error?: string;
}

/** 사유 코드를 사용자 문구로. Supabase 원본 메시지는 로그에만 남는다. */
const PAY_MESSAGES: Record<PaymentErrorCode, string> = {
  AUTH_REQUIRED: "로그인이 필요합니다. 다시 로그인해 주세요.",
  NOT_FOUND: "모임을 찾을 수 없어요.",
  CLOSED: "모집이 종료되었어요.",
  HEADCOUNT: "신청 가능한 인원을 확인해 주세요.",
  ALREADY_PAID: "이미 결제한 모임이에요. 마이 페이지 > 결제 내역에서 확인할 수 있어요.",
  SOLD_OUT: "결제 중 자리가 마감되었어요.",
  ALREADY_CANCELED: "이미 취소된 결제예요.",
  NO_REFUND: "환불 가능 기간이 지났어요.",
  BAD_REFUND: "환불 금액을 다시 계산해야 해요. 잠시 후 다시 시도해 주세요.",
  UNKNOWN: "결제에 실패했어요. 잠시 후 다시 시도해 주세요.",
};

export async function payMeeting(
  _previous: PayFormState,
  formData: FormData,
): Promise<PayFormState> {
  const meetingId = String(formData.get("meetingId") ?? "");
  const headcount = Number(formData.get("headcount") ?? 0);
  const agreed = formData.get("agreed") === "on";

  if (!meetingId) return { error: PAY_MESSAGES.NOT_FOUND };
  if (!Number.isInteger(headcount) || headcount < 1) {
    return { error: PAY_MESSAGES.HEADCOUNT };
  }
  // 체크박스는 화면에서도 버튼을 막지만, 폼은 직접 전송될 수 있다.
  if (!agreed) return { error: "환불 규정 확인에 동의해 주세요." };

  // 비로그인이면 시트가 아니라 로그인으로 보낸다. 돌아올 곳은 시트가 열린 상세다.
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/meetings/${meetingId}?pay=1`)}`);
  }

  let orderNo: string;
  try {
    orderNo = await createPayment(meetingId, headcount);
  } catch (reason) {
    if (reason instanceof PaymentError) {
      return { error: PAY_MESSAGES[reason.code] };
    }
    throw reason;
  }

  // 남은 자리가 줄었다. 배너·상세가 캐시된 수를 보여 주면 다음 사람이 마감된
  // 모임을 결제하려 든다.
  revalidatePath("/");
  revalidatePath(`/meetings/${meetingId}`);

  // redirect는 예외를 던진다. try 밖에서 불러야 위 catch에 걸리지 않는다.
  redirect(`/payments/${orderNo}`);
}
```

- [ ] **Step 5: `src/components/meetings/MeetingPaySheet.tsx`**

design.pen `06b Payment Bottom Sheet`의 `OQqXe`.

```tsx
"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Stepper } from "../ui/Stepper";
import { formatWon } from "../../lib/meetings/format";
import { payMeeting, type PayFormState } from "../../lib/payments/actions";

export interface MeetingPaySheetProps {
  meetingId: string;
  price: number;
  seatsTaken: number;
  capacity: number;
  seatsLeft: number;
  /** `min(남은 자리, 1인당 최대)`. */
  maxSelectable: number;
  maxPerPerson: number;
  /** 시트를 닫으면 돌아갈 곳 — 쿼리를 뗀 상세 경로. */
  closeHref: string;
}

/**
 * 결제 바텀시트.
 *
 * 열림 상태는 이 컴포넌트가 아니라 URL(`?pay=1`)이 들고 있다. 비로그인 사용자가
 * 로그인을 다녀오면 같은 URL로 돌아오므로 시트가 그대로 열려 있다.
 *
 * 실패해도 시트를 닫지 않고 그 자리에 사유를 띄운다(PRD 291). 총액은 표시용이고
 * 실제 청구 금액은 `pay_meeting`이 다시 계산한다.
 */
export function MeetingPaySheet({
  meetingId,
  price,
  seatsTaken,
  capacity,
  seatsLeft,
  maxSelectable,
  maxPerPerson,
  closeHref,
}: MeetingPaySheetProps) {
  const router = useRouter();
  const [headcount, setHeadcount] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [state, formAction, pending] = useActionState<PayFormState, FormData>(
    payMeeting,
    {},
  );

  const total = price * headcount;
  // 상한이 남은 자리 때문에 걸렸는지, 1인당 한도 때문인지에 따라 안내가 다르다.
  const hint =
    maxSelectable < maxPerPerson
      ? `남은 자리가 ${seatsLeft}개입니다`
      : `최대 ${maxPerPerson}명까지 신청할 수 있어요`;

  return (
    <BottomSheet
      floating
      title="결제하기"
      onClose={() => router.replace(closeHref, { scroll: false })}
    >
      <p className="type-label-md text-text-muted">
        {`참여 ${seatsTaken}명 / 최대 ${capacity}명 · 남은 ${seatsLeft}석`}
      </p>

      <div className="flex items-center justify-between gap-3">
        <span className="type-label-lg text-text-default">참여 인원</span>
        <Stepper
          value={headcount}
          max={maxSelectable}
          onChange={setHeadcount}
          decreaseLabel="인원 줄이기"
          increaseLabel="인원 늘리기"
        />
      </div>

      <p className="type-label-md text-text-subtle">{hint}</p>

      <span aria-hidden className="h-px w-full bg-border-default" />

      <div className="flex items-center justify-between gap-3">
        <span className="type-body-md text-text-muted">
          {`1인 ${formatWon(price)} × ${headcount}명`}
        </span>
        <span className="type-heading-md text-text-default">{formatWon(total)}</span>
      </div>

      <form action={formAction} className="flex flex-col gap-3.5">
        <input type="hidden" name="meetingId" value={meetingId} />
        <input type="hidden" name="headcount" value={headcount} />

        <Checkbox
          name="agreed"
          checked={agreed}
          onChange={() => setAgreed((previous) => !previous)}
        >
          환불 규정을 확인했습니다
        </Checkbox>

        {state.error && (
          <p role="alert" className="type-label-md text-text-error">
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!agreed || seatsLeft <= 0}
          loading={pending}
        >
          {`${formatWon(total)} 결제하기`}
        </Button>
      </form>
    </BottomSheet>
  );
}
```

- [ ] **Step 6: 상세 화면에서 `?pay=1`이면 시트를 띄운다**

`src/app/meetings/[id]/page.tsx`:

```tsx
// import 추가
import { MeetingPaySheet } from "../../../components/meetings/MeetingPaySheet";
```

```tsx
export default async function MeetingDetailPage(
  props: PageProps<"/meetings/[id]">,
) {
  const { id } = await props.params;
  const { pay } = await props.searchParams;
  // viewer / meeting / paidId 조회는 Task 6에서 쓴 세 줄 그대로 둔다.

  // 결제할 수 없는 상태에서 쿼리만 붙여 들어오는 경우가 있다. 시트를 띄우기 전에
  // 서버가 다시 판단한다 — 화면 상태를 URL이 정하게 두지 않는다.
  const sheetOpen =
    pay === "1" && Boolean(viewer) && !paidId && meeting.sale === "on_sale";
```

`</AppShell>` 바로 앞에 넣는다.

```tsx
      {sheetOpen && (
        <MeetingPaySheet
          meetingId={meeting.id}
          price={meeting.price}
          seatsTaken={meeting.seatsTaken}
          capacity={meeting.capacity}
          seatsLeft={meeting.seatsLeft}
          maxSelectable={meeting.maxSelectable}
          maxPerPerson={meeting.maxPerPerson}
          closeHref={`/meetings/${meeting.id}`}
        />
      )}
```

- [ ] **Step 7: `src/app/payments/[orderNo]/page.tsx`**

design.pen `07 Payment Complete`.

```tsx
import { notFound, redirect } from "next/navigation";

import { Icon } from "../../../components/foundation/Icon";
import { AppShell } from "../../../components/layout/AppShell";
import { PageContainer } from "../../../components/layout/PageContainer";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { DetailRow } from "../../../components/ui/DetailRow";
import { NotFoundError } from "../../../lib/api/http";
import { getCurrentUser } from "../../../lib/auth/session";
import {
  formatMeetingDateTime,
  formatTimestamp,
  formatWon,
} from "../../../lib/meetings/format";
import type { PaymentDto } from "../../../lib/payments/dto";
import { getPaymentByOrderNo } from "../../../lib/payments/service";

/**
 * 결제 완료 — design.pen `07 Payment Complete`.
 *
 * 주문번호로 조회하는 화면이다. 새로 고치거나 뒤로 갔다 다시 와도 결제가 다시
 * 일어나지 않는다(PRD 299). 결제를 일으키는 것은 서버 액션 한 곳뿐이다.
 *
 * 남의 주문번호는 RLS에 걸려 404가 된다.
 */
export default async function PaymentCompletePage(
  props: PageProps<"/payments/[orderNo]">,
) {
  const { orderNo } = await props.params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/payments/${orderNo}`)}`);
  }
  const payment = await loadPayment(orderNo, user.id);

  return (
    <AppShell tabBar={false}>
      <PageContainer
        as="main"
        width="form"
        className="flex flex-col gap-4 py-24 md:py-32"
      >
        <header className="flex flex-col items-center gap-2.5 pt-4 pb-2">
          <span
            className="flex size-[72px] items-center justify-center rounded-full bg-background-success text-text-success"
            aria-hidden
          >
            <Icon name="check" size={32} />
          </span>
          <h1 className="type-heading-lg text-text-default md:type-display-sm">
            결제가 완료되었어요
          </h1>
          <p className="type-body-md text-center text-text-muted">
            {`${payment.meeting.title} 신청이 확정되었어요.`}
          </p>
        </header>

        <section
          aria-label="결제 정보"
          className="flex flex-col gap-3 rounded-2xl border border-border-default bg-background-surface p-4"
        >
          <DetailRow label="주문번호">{payment.orderNo}</DetailRow>
          <DetailRow label="모임">{payment.meeting.title}</DetailRow>
          <DetailRow label="일시">
            {formatMeetingDateTime(payment.meeting.startsAt)}
          </DetailRow>
          <DetailRow label="장소">{payment.meeting.address}</DetailRow>
          <DetailRow label="참여 인원">{`${payment.headcount}명`}</DetailRow>

          <span aria-hidden className="h-px w-full bg-border-default" />

          <DetailRow label="결제 금액" tone="text-text-brand">
            {formatWon(payment.amount)}
          </DetailRow>
          <DetailRow label="결제 수단">{payment.method}</DetailRow>
          <DetailRow label="결제 일시">{formatTimestamp(payment.paidAt)}</DetailRow>
        </section>

        <p className="type-label-md text-text-subtle">
          결제 내역은 마이 페이지 &gt; 결제 내역에서 확인할 수 있어요. 모임 3일
          전까지 취소 시 차등 환불됩니다.
        </p>

        <div className="flex flex-col gap-2">
          <ButtonLink href="/my?tab=payments" size="lg" className="w-full">
            결제 내역 보기
          </ButtonLink>
          <ButtonLink href="/" variant="secondary" size="lg" className="w-full">
            메인으로 돌아가기
          </ButtonLink>
        </div>
      </PageContainer>
    </AppShell>
  );
}

async function loadPayment(orderNo: string, userId: string): Promise<PaymentDto> {
  try {
    return await getPaymentByOrderNo(orderNo, userId);
  } catch (reason) {
    if (reason instanceof NotFoundError) {
      notFound();
    }
    throw reason;
  }
}
```

- [ ] **Step 8: `/payments`를 보호 경로에 넣는다**

`src/lib/supabase/proxy.ts`:

```ts
/** 로그인해야만 열리는 경로. 나머지는 비로그인도 볼 수 있다. */
const PROTECTED_PREFIXES = ["/my", "/register", "/payments"];
```

- [ ] **Step 9: 확인**

```bash
npx tsc --noEmit
npx eslint src/app/payments src/components/meetings src/components/ui src/lib/payments src/lib/supabase/proxy.ts --max-warnings=0
npm run dev
```

로그인한 상태로 상세에서 `결제하기`를 누른다:
- 시트가 아래에서 올라오고 스크림 뒤 화면이 스크롤되지 않는다. Esc·스크림으로 닫힌다.
- `참여 0명 / 최대 20명 · 남은 20석`, `최대 4명까지 신청할 수 있어요`.
- 인원을 2로 올리면 `1인 25,000원 × 2명`과 `50,000원`, 버튼이 `50,000원 결제하기`.
- 동의 체크 전에는 버튼이 비활성. `+`는 4에서 멈춘다.
- 결제하면 `/payments/PMT-…`로 이동하고, 새로 고쳐도 중복 결제가 생기지 않는다
  (`select count(*) from payment` 확인).
- 같은 모임을 다시 결제하려 하면 상세 CTA가 `결제 내역 보기`다.
- md(834) 폭에서 시트가 화면 가운데 다이얼로그로 뜬다.
- 로그아웃 상태로 `/payments/PMT-…`를 열면 로그인으로 보내고, 다른 사람의 주문번호는 404.

- [ ] **Step 10: 커밋**

```bash
git add src/components/ui/DetailRow.tsx src/components/meetings src/components/ui/Modal.tsx \
        src/lib/payments src/app/payments src/app/meetings src/lib/supabase/proxy.ts src/stories/ui
git commit -m "feat: 결제 시트와 결제 완료 화면

시트의 열림 상태를 URL에 둔다. 비로그인이 로그인을 다녀와도 같은 자리로
돌아오고, 사용자가 방금 누른 버튼을 다시 찾지 않는다.

총액은 표시용이다. 청구 금액은 pay_meeting이 meeting.price로 다시 계산하고,
완료 화면은 주문번호로 조회만 하므로 새로 고쳐도 재결제가 없다."
```

---

### Task 8: 마이 페이지 3탭과 결제 취소

**Files:**
- Modify: `src/lib/payments/dto.ts` (파생 상태 함수)
- Create: `src/lib/payments/format.ts`
- Modify: `src/lib/payments/service.ts` (`listMyPayments`, `getMyPayment`, `applyCancellation`)
- Modify: `src/lib/payments/actions.ts` (`cancelPayment`)
- Create: `src/components/payments/PaymentHistoryCard.tsx`
- Create: `src/components/payments/CancellationCard.tsx`
- Create: `src/components/payments/CancelPaymentModal.tsx`
- Modify: `src/app/my/page.tsx` (3탭 + 모달)

**Interfaces:**
- Consumes: Task 1의 `refundPlanFor`·`refundRuleByKey`·`refundRuleLabel`, Task 3의 `cancel_payment` RPC, Task 5의 `Badge(tone="soft")`·`TabNavigation(variant="inline")`·`Modal(floating)`, Task 7의 `PaymentDto`·`DetailRow`
- Produces:
  - `attendanceStateOf(payment, now?): "upcoming" | "done"`
  - `refundStateOf(payment, now?): "processing" | "done"`
  - `cancelabilityOf(payment, now?): { cancelable: boolean; blocked: "ended" | "no_refund" | null; plan: RefundPlan }`
  - `listMyPayments(userId: string, status: "paid" | "canceled"): Promise<PaymentDto[]>`
  - `getMyPayment(id: string, userId: string): Promise<PaymentDto>`
  - `applyCancellation(paymentId: string, plan: RefundPlan): Promise<void>`
  - `cancelPayment(prev: PayFormState, formData: FormData): Promise<PayFormState>`
  - `<PaymentHistoryCard payment={PaymentDto} cancelHref={string} />`, `<CancellationCard payment={PaymentDto} />`, `<CancelPaymentModal … />`

- [ ] **Step 1: `dto.ts`에 파생 상태를 더한다**

화면마다 `startsAt > now`를 다시 비교하면 한 곳만 규칙이 바뀌는 날이 온다.

```ts
import { refundPlanFor, type RefundPlan, type RefundRuleKey } from "./refund";

// …기존 PaymentDto…

/** 결제 내역 배지 — 모임이 아직 안 열렸으면 `참여 예정`, 지났으면 `참여 완료`. */
export type AttendanceState = "upcoming" | "done";

export function attendanceStateOf(
  payment: PaymentDto,
  now: Date = new Date(),
): AttendanceState {
  return new Date(payment.meeting.startsAt) > now ? "upcoming" : "done";
}

/**
 * 취소 내역 배지.
 *
 * 모의 결제라 환불이 즉시 끝나지만, 그러면 `환불 처리 중`이 화면에 영원히 나타나지
 * 않고 "카드 환불은 3~5일 걸릴 수 있어요" 안내가 거짓이 된다. 취소할 때 적어 둔
 * 완료 예정 시각(취소 + 3일)을 지나면 완료로 읽는다.
 */
export type RefundState = "processing" | "done";

export function refundStateOf(
  payment: PaymentDto,
  now: Date = new Date(),
): RefundState {
  if (!payment.refundCompletesAt) return "done";
  return new Date(payment.refundCompletesAt) <= now ? "done" : "processing";
}

/** 취소 버튼을 못 내보내는 사유(PRD 310). */
export type CancelBlock = "ended" | "no_refund";

export interface Cancelability {
  cancelable: boolean;
  blocked: CancelBlock | null;
  /** 지금 취소하면 적용될 규정과 환불액. 서버 시각 기준. */
  plan: RefundPlan;
}

export function cancelabilityOf(
  payment: PaymentDto,
  now: Date = new Date(),
): Cancelability {
  const plan = refundPlanFor(payment.amount, payment.meeting.startsAt, now);

  if (new Date(payment.meeting.startsAt) <= now) {
    return { cancelable: false, blocked: "ended", plan };
  }
  if (plan.rule.rate === 0) {
    return { cancelable: false, blocked: "no_refund", plan };
  }
  return { cancelable: true, blocked: null, plan };
}

export const CANCEL_BLOCK_LABELS: Record<CancelBlock, string> = {
  ended: "종료된 모임",
  no_refund: "환불 기간 종료",
};

export type { RefundRuleKey };
```

- [ ] **Step 2: `src/lib/payments/format.ts`**

```ts
import { formatMeetingShort, formatMonthDay, formatWon } from "../meetings/format";
import { refundRuleByKey, refundRuleLabel } from "./refund";
import {
  attendanceStateOf,
  refundStateOf,
  type AttendanceState,
  type PaymentDto,
  type RefundState,
} from "./dto";
import type { BadgeVariant } from "../../components/ui/Badge";

/**
 * 결제·취소 내역 카드의 문구.
 *
 * 서버 전용이 아니다. 카드는 서버 컴포넌트지만 모달(클라이언트)도 같은 문구를 쓴다.
 */

/** `12/14 토 14:00 · 2명`. */
export function paymentScheduleLine(payment: PaymentDto): string {
  return `${formatMeetingShort(payment.meeting.startsAt)} · ${payment.headcount}명`;
}

/** `50,000원 · 12/13 결제`. */
export function paymentAmountLine(payment: PaymentDto): string {
  return `${formatWon(payment.amount)} · ${formatMonthDay(payment.paidAt)} 결제`;
}

/** `결제 30,000원 · 환불 30,000원`. */
export function cancellationAmountLine(payment: PaymentDto): string {
  return `결제 ${formatWon(payment.amount)} · 환불 ${formatWon(payment.refundAmount ?? 0)}`;
}

/**
 * `적용 규정: 모임 3~7일 전 (50%)`.
 *
 * 저장된 규정 키로 문구를 다시 만든다. 시안은 이 자리에만 `3~7일 전 취소` 표현을
 * 쓰지만, 네 화면이 같은 문구를 써야 하므로 규정 표와 같은 표현으로 통일한다.
 */
export function cancellationRuleLine(payment: PaymentDto): string {
  if (!payment.refundRule) return "적용 규정 확인 중";
  return `적용 규정: ${refundRuleLabel(refundRuleByKey(payment.refundRule))}`;
}

/** `12/05 취소`. */
export function cancellationDateLine(payment: PaymentDto): string {
  return payment.canceledAt ? `${formatMonthDay(payment.canceledAt)} 취소` : "";
}

export interface StatusBadge {
  label: string;
  variant: BadgeVariant;
}

const ATTENDANCE_BADGES: Record<AttendanceState, StatusBadge> = {
  upcoming: { label: "참여 예정", variant: "brand" },
  done: { label: "참여 완료", variant: "neutral" },
};

const REFUND_BADGES: Record<RefundState, StatusBadge> = {
  processing: { label: "환불 처리 중", variant: "warning" },
  done: { label: "환불 완료", variant: "success" },
};

export function attendanceBadge(payment: PaymentDto, now?: Date): StatusBadge {
  return ATTENDANCE_BADGES[attendanceStateOf(payment, now)];
}

export function refundBadge(payment: PaymentDto, now?: Date): StatusBadge {
  return REFUND_BADGES[refundStateOf(payment, now)];
}

/** 취소 내역 탭 상단 고정 안내(PRD 324). */
export const REFUND_DELAY_NOTE =
  "카드 환불은 카드사 사정으로 3~5일 걸릴 수 있어요.";
```

- [ ] **Step 3: `service.ts`에 목록·단건·취소를 더한다**

```ts
import type { RefundPlan } from "./refund";

/**
 * 내 결제 내역. `paid`는 결제 최신순, `canceled`는 취소 최신순(PRD 307, 322).
 *
 * RLS가 자기 행만 보여 주지만 `user_id` 조건을 함께 쓴다.
 */
export async function listMyPayments(
  userId: string,
  status: "paid" | "canceled",
): Promise<PaymentDto[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment")
    .select(PAYMENT_SELECT)
    .eq("user_id", userId)
    .eq("status", status)
    .order(status === "paid" ? "paid_at" : "canceled_at", { ascending: false });

  if (error) {
    console.error("[payments] 내역 조회 실패", error);
    throw new Error("결제 내역을 불러오지 못했습니다.");
  }

  return ((data ?? []) as unknown as PaymentRow[]).map(toPaymentDto);
}

/** 내 결제 한 건. 남의 것은 없는 것과 같이 404다. */
export async function getMyPayment(
  id: string,
  userId: string,
): Promise<PaymentDto> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment")
    .select(PAYMENT_SELECT)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[payments] 결제 조회 실패", error);
    throw new Error("결제 정보를 불러오지 못했습니다.");
  }
  if (!data) {
    throw new NotFoundError("결제 내역을 찾을 수 없습니다.");
  }

  return toPaymentDto(data as unknown as PaymentRow);
}

/**
 * 취소를 적용한다.
 *
 * 비율은 서버가 `refund.ts`로 정하고, 함수는 원자성과 자격만 본다. 함수도 환불액이
 * 결제액을 넘지 않는지 다시 확인하므로, 계산이 어긋나는 날 돈이 더 나가지 않는다.
 */
export async function applyCancellation(
  paymentId: string,
  plan: RefundPlan,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_payment", {
    p_payment_id: paymentId,
    p_refund_amount: plan.amount,
    p_refund_rate: plan.rule.rate,
    p_refund_rule: plan.rule.key,
  });

  if (error) {
    console.error("[payments] 취소 실패", error);
    throw toPaymentError(error);
  }
}
```

- [ ] **Step 4: `actions.ts`에 `cancelPayment`를 더한다**

```ts
import { refundPlanFor } from "./refund";
import { applyCancellation, getMyPayment } from "./service";
import { NotFoundError } from "@/lib/api/http";

/**
 * 결제를 취소한다.
 *
 * 환불 금액은 클라이언트가 보낸 값을 쓰지 않는다. 여기서 서버 시각으로 다시
 * 계산하고, 모달이 보여 준 금액은 표시용이다(PRD 374).
 */
export async function cancelPayment(
  _previous: PayFormState,
  formData: FormData,
): Promise<PayFormState> {
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) return { error: PAY_MESSAGES.NOT_FOUND };

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/my?tab=payments")}`);
  }

  let meetingId: string;
  try {
    const payment = await getMyPayment(paymentId, user.id);
    meetingId = payment.meeting.id;

    if (payment.status !== "paid") return { error: PAY_MESSAGES.ALREADY_CANCELED };

    const plan = refundPlanFor(payment.amount, payment.meeting.startsAt);
    if (plan.rule.rate === 0) return { error: PAY_MESSAGES.NO_REFUND };

    await applyCancellation(paymentId, plan);
  } catch (reason) {
    if (reason instanceof PaymentError) return { error: PAY_MESSAGES[reason.code] };
    if (reason instanceof NotFoundError) return { error: PAY_MESSAGES.NOT_FOUND };
    throw reason;
  }

  // 자리가 하나 돌아왔다. 배너와 상세의 남은 자리가 그대로면 마감된 것처럼 보인다.
  revalidatePath("/");
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/my");

  redirect("/my?tab=cancels");
}
```

`PaymentError`와 `getMyPayment`가 import 목록에 들어가야 한다. 기존 import 줄을 고친다:

```ts
import {
  applyCancellation,
  createPayment,
  getMyPayment,
  PaymentError,
  type PaymentErrorCode,
} from "./service";
```

- [ ] **Step 5: `src/components/payments/PaymentHistoryCard.tsx`**

design.pen `05b My Page - Payments`의 `pay-…` 카드.

```tsx
import Image from "next/image";
import Link from "next/link";

import { Icon } from "../foundation/Icon";
import { Badge } from "../ui/Badge";
import { ButtonLink } from "../ui/ButtonLink";
import {
  CANCEL_BLOCK_LABELS,
  cancelabilityOf,
  type PaymentDto,
} from "../../lib/payments/dto";
import {
  attendanceBadge,
  paymentAmountLine,
  paymentScheduleLine,
} from "../../lib/payments/format";

export interface PaymentHistoryCardProps {
  payment: PaymentDto;
  /** 취소 모달을 여는 경로. */
  cancelHref: string;
}

/**
 * 결제 내역 한 장.
 *
 * 카드 전체가 모임 상세로 가는 링크지만(PRD 309) 취소 버튼은 링크 안에 넣을 수
 * 없다. 제목만 링크로 두고 취소는 카드 아래 별도 줄에 놓는다.
 */
export function PaymentHistoryCard({
  payment,
  cancelHref,
}: PaymentHistoryCardProps) {
  const badge = attendanceBadge(payment);
  const { cancelable, blocked } = cancelabilityOf(payment);

  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-border-default bg-background-surface p-3">
      <div className="flex gap-3">
        <Thumbnail
          imageUrl={payment.meeting.imageUrl}
          alt={payment.meeting.title}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="flex items-center justify-between gap-1.5">
            <Link
              href={`/meetings/${payment.meeting.id}`}
              className="type-label-lg min-w-0 truncate text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
            >
              {payment.meeting.title}
            </Link>
            <Badge variant={badge.variant} tone="soft" size="lg">
              {badge.label}
            </Badge>
          </div>
          <span className="type-label-md text-text-muted">
            {paymentScheduleLine(payment)}
          </span>
          <span className="type-label-md text-text-muted">
            {paymentAmountLine(payment)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end">
        {cancelable ? (
          <ButtonLink href={cancelHref} variant="secondary" size="sm" scroll={false}>
            결제 취소
          </ButtonLink>
        ) : (
          <span className="type-label-md text-text-subtle">
            {blocked ? CANCEL_BLOCK_LABELS[blocked] : ""}
          </span>
        )}
      </div>
    </li>
  );
}

/** 56px 정사각 썸네일. 이미지가 없으면 시안처럼 아이콘 자리표시자를 그린다. */
export function Thumbnail({
  imageUrl,
  alt,
}: {
  imageUrl: string | null;
  alt: string;
}) {
  if (!imageUrl) {
    return (
      <span
        className="flex size-14 shrink-0 items-center justify-center rounded-[10px] bg-background-brand-subtle text-text-subtle"
        aria-hidden
      >
        <Icon name="image" size={24} />
      </span>
    );
  }

  return (
    <span className="relative size-14 shrink-0 overflow-hidden rounded-[10px]">
      <Image src={imageUrl} alt={alt} fill sizes="56px" className="object-cover" />
    </span>
  );
}
```

- [ ] **Step 6: `src/components/payments/CancellationCard.tsx`**

```tsx
import Link from "next/link";

import { Badge } from "../ui/Badge";
import { Thumbnail } from "./PaymentHistoryCard";
import type { PaymentDto } from "../../lib/payments/dto";
import {
  cancellationAmountLine,
  cancellationDateLine,
  cancellationRuleLine,
  refundBadge,
} from "../../lib/payments/format";

/** 취소 내역 한 장 — design.pen `05c My Page - Cancellations`의 `cx-…` 카드. */
export function CancellationCard({ payment }: { payment: PaymentDto }) {
  const badge = refundBadge(payment);

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-border-default bg-background-surface p-3">
      <div className="flex gap-3">
        <Thumbnail
          imageUrl={payment.meeting.imageUrl}
          alt={payment.meeting.title}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="flex items-center justify-between gap-1.5">
            <Link
              href={`/meetings/${payment.meeting.id}`}
              className="type-label-lg min-w-0 truncate text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
            >
              {payment.meeting.title}
            </Link>
            <Badge variant={badge.variant} tone="soft" size="lg">
              {badge.label}
            </Badge>
          </div>
          <span className="type-label-md text-text-muted">
            {cancellationAmountLine(payment)}
          </span>
          <span className="type-label-md text-text-muted">
            {cancellationRuleLine(payment)}
          </span>
          <span className="type-label-md text-text-subtle">
            {cancellationDateLine(payment)}
          </span>
        </div>
      </div>
    </li>
  );
}
```

- [ ] **Step 7: `src/components/payments/CancelPaymentModal.tsx`**

design.pen `05d My Page - Cancel Confirm`의 `BtYry`.

```tsx
"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "../ui/Button";
import { DetailRow } from "../ui/DetailRow";
import { Modal } from "../ui/Modal";
import { formatWon } from "../../lib/meetings/format";
import { cancelPayment, type PayFormState } from "../../lib/payments/actions";

export interface CancelPaymentModalProps {
  paymentId: string;
  meetingTitle: string;
  headcount: number;
  amount: number;
  /** 서버가 계산한 환불 예정 금액. 표시용이고 확정은 액션이 다시 한다. */
  refundAmount: number;
  /** `모임 3~7일 전 (50%)`. */
  ruleLabel: string;
  /** 닫으면 돌아갈 곳. */
  closeHref: string;
}

/**
 * 결제 취소 확인 — 결제 금액 · 적용 규정 · 환불 예정 금액을 함께 보여 준다(PRD 315).
 *
 * 금액은 서버가 계산해 props로 내려온다. 클라이언트에서 다시 계산하면 사용자 기기
 * 시각에 따라 다른 규정이 보일 수 있다.
 */
export function CancelPaymentModal({
  paymentId,
  meetingTitle,
  headcount,
  amount,
  refundAmount,
  ruleLabel,
  closeHref,
}: CancelPaymentModalProps) {
  const router = useRouter();
  const close = () => router.replace(closeHref, { scroll: false });
  const [state, formAction, pending] = useActionState<PayFormState, FormData>(
    cancelPayment,
    {},
  );

  return (
    <Modal
      floating
      title="결제를 취소할까요?"
      onClose={close}
      actions={
        <form action={formAction} className="flex w-full gap-2">
          <input type="hidden" name="paymentId" value={paymentId} />
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={close}
          >
            돌아가기
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="lg"
            className="flex-1"
            loading={pending}
          >
            결제 취소
          </Button>
        </form>
      }
    >
      <div className="flex flex-col gap-4 pb-1">
        <p className="type-body-md text-text-muted">
          {`${meetingTitle} · ${headcount}명`}
        </p>

        <div className="flex flex-col gap-2.5 rounded-xl bg-background-subtle p-3.5">
          <DetailRow label="결제 금액">{formatWon(amount)}</DetailRow>
          <DetailRow label="적용 규정">{ruleLabel}</DetailRow>
          <span aria-hidden className="h-px w-full bg-border-default" />
          <div className="flex items-center justify-between gap-3">
            <span className="type-label-md shrink-0 text-text-muted">
              환불 예정 금액
            </span>
            <span className="type-heading-md text-text-brand">
              {formatWon(refundAmount)}
            </span>
          </div>
        </div>

        <p className="type-label-md text-text-subtle">
          환불 규정에 따라 일부 금액만 환불돼요. 취소 후에는 되돌릴 수 없어요.
        </p>

        {state.error && (
          <p role="alert" className="type-label-md text-text-error">
            {state.error}
          </p>
        )}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 8: `src/app/my/page.tsx`를 3탭으로 바꾼다**

프로필·스탯 블록과 하단 그리드는 그대로 두고, `TabNavigation` 호출과 그 아래
`section`을 탭에 따라 갈리게 바꾼다. `저장한 곳` 탭은 지운다.

```tsx
// import 추가
import { notFound } from "next/navigation";

import { CancellationCard } from "../../components/payments/CancellationCard";
import { CancelPaymentModal } from "../../components/payments/CancelPaymentModal";
import { PaymentHistoryCard } from "../../components/payments/PaymentHistoryCard";
import { cancelabilityOf } from "../../lib/payments/dto";
import { REFUND_DELAY_NOTE } from "../../lib/payments/format";
import { refundRuleLabel } from "../../lib/payments/refund";
import { getMyPayment, listMyPayments } from "../../lib/payments/service";
import { NotFoundError } from "../../lib/api/http";
import { ButtonLink } from "../../components/ui/ButtonLink";
// 폭 값을 페이지에 다시 적지 않는다.
import { PageContainer, WIDTHS } from "../../components/layout/PageContainer";
```

```tsx
/** 마이 페이지의 세 탭(PRD 304). 순서가 화면 순서다. */
const MY_TABS = [
  { key: "posts", label: "내가 쓴 글", href: "/my" },
  { key: "payments", label: "결제 내역", href: "/my?tab=payments" },
  { key: "cancels", label: "취소 내역", href: "/my?tab=cancels" },
] as const;

type MyTabKey = (typeof MY_TABS)[number]["key"];

function toTabKey(value: string | string[] | undefined): MyTabKey {
  const key = Array.isArray(value) ? value[0] : value;
  return MY_TABS.some((tab) => tab.key === key) ? (key as MyTabKey) : "posts";
}
```

`MyPage` 본문:

```tsx
export default async function MyPage(props: PageProps<"/my">) {
  const { tab, cancel } = await props.searchParams;
  const activeTab = toTabKey(tab);

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/my")}`);
  }

  // 탭마다 출처가 달라 활성 탭의 것만 읽는다. 세 개를 다 읽으면 안 보는 목록까지
  // 매번 조회한다.
  const [profile, posts, payments] = await Promise.all([
    getMyProfile(user),
    activeTab === "posts"
      ? listPlaces({ viewerId: user.id, authorId: user.id })
      : Promise.resolve([]),
    activeTab === "posts"
      ? Promise.resolve([])
      : listMyPayments(user.id, activeTab === "payments" ? "paid" : "canceled"),
  ]);

  // 취소 모달은 쿼리로 열린다. 금액을 서버가 계산해 함께 렌더한다.
  const cancelId = Array.isArray(cancel) ? cancel[0] : cancel;
  const cancelTarget = cancelId ? await getMyPayment(cancelId, user.id) : null;
  if (cancelTarget && cancelTarget.status !== "paid") {
    // 이미 취소된 건의 링크를 다시 열면 모달 없이 목록만 보여 준다.
    redirect("/my?tab=cancels");
  }
  const cancelPlan = cancelTarget ? cancelabilityOf(cancelTarget) : null;
```

탭과 목록 부분:

```tsx
          <TabNavigation
            variant="inline"
            value={MY_TABS.findIndex((item) => item.key === activeTab)}
            tabs={MY_TABS.map((item) => ({ label: item.label, href: item.href }))}
          />
        </div>

        {activeTab === "posts" && (
          <section aria-label="내가 쓴 글">
            {/*
              기존 코드의 `posts.length === 0 ? <Empty …/> : <ul className="grid …">`
              블록을 그대로 옮긴다. 1280 그리드(1 → 2 → 3 → 4열)를 유지한다.
            */}
          </section>
        )}

        {activeTab === "payments" && (
          // 읽는 목록이라 800에서 멈춘다. 숫자를 다시 적지 않도록 PageContainer의
          // 폭 표를 쓴다 — 폭 규칙은 한 곳에만 있어야 한다.
          <section aria-label="결제 내역" className={`w-full ${WIDTHS.article}`}>
            {payments.length === 0 ? (
              <Empty
                icon="calendar"
                title="아직 결제한 모임이 없어요"
                description="메인 화면 배너에서 이번 달 모임을 볼 수 있어요."
                actions={
                  <ButtonLink href="/" variant="secondary" size="md">
                    모임 보러 가기
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {payments.map((payment) => (
                  <PaymentHistoryCard
                    key={payment.id}
                    payment={payment}
                    cancelHref={`/my?tab=payments&cancel=${payment.id}`}
                  />
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === "cancels" && (
          <section
            aria-label="취소 내역"
            className={`flex w-full flex-col gap-3 ${WIDTHS.article}`}
          >
            {/* 탭 상단 고정 안내(PRD 324). 목록이 비어도 보인다. */}
            <p className="type-label-md flex items-center gap-2 rounded-[10px] bg-background-subtle px-3 py-2.5 text-text-muted">
              <Icon name="info" size={20} />
              {REFUND_DELAY_NOTE}
            </p>
            {payments.length === 0 ? (
              <Empty
                icon="refresh"
                title="취소한 내역이 없어요"
                description="결제한 모임을 취소하면 여기에 남아요."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {payments.map((payment) => (
                  <CancellationCard key={payment.id} payment={payment} />
                ))}
              </ul>
            )}
          </section>
        )}
      </PageContainer>

      {cancelTarget && cancelPlan && (
        <CancelPaymentModal
          paymentId={cancelTarget.id}
          meetingTitle={cancelTarget.meeting.title}
          headcount={cancelTarget.headcount}
          amount={cancelTarget.amount}
          refundAmount={cancelPlan.plan.amount}
          ruleLabel={refundRuleLabel(cancelPlan.plan.rule)}
          closeHref="/my?tab=payments"
        />
      )}
    </AppShell>
  );
}
```

`ButtonLink` import를 추가한다. `notFound`는 `getMyPayment`가 던지는 `NotFoundError`를
받는 데 쓴다 — 상세·완료 화면과 같은 방식으로 감싼다.

```tsx
/** 없는 결제와 남의 결제는 똑같이 404다. */
async function loadCancelTarget(id: string, userId: string) {
  try {
    return await getMyPayment(id, userId);
  } catch (reason) {
    if (reason instanceof NotFoundError) notFound();
    throw reason;
  }
}
```

`const cancelTarget = cancelId ? await loadCancelTarget(cancelId, user.id) : null;`로
바꾸고 `NotFoundError`를 import한다.

- [ ] **Step 9: 확인**

```bash
npx tsc --noEmit
npx eslint src/app/my src/components/payments src/lib/payments --max-warnings=0
npm run dev
```

`/my`에서:
- 탭 3개, 활성 탭만 브랜드색 + 2px 밑줄. 탭을 누르면 URL이 `?tab=payments`로 바뀐다.
- 결제 내역에 방금 결제한 건이 `참여 예정` 배지와 `결제 취소` 버튼과 함께 보인다.
- 8/19 모임(3일 이내)을 결제하면 버튼 대신 `환불 기간 종료`가 보인다.
- `결제 취소`를 누르면 모달이 뜨고 `결제 금액 50,000원`, `적용 규정 모임 7일 전까지 (100%)`,
  `환불 예정 금액 50,000원`이 보인다. `돌아가기`는 목록으로, Esc로도 닫힌다.
- 확인하면 `?tab=cancels`로 이동하고 카드에 `환불 처리 중`(취소 직후) 배지가 붙는다.
- 취소 내역 탭 상단에 환불 지연 안내가 항상 보인다.
- 8/22 모임(3~7일 전)을 결제하고 취소하면 환불 예정 금액이 결제액의 50%다.
- 취소 후 모임 상세의 남은 자리가 되돌아왔다.
- 390 / 834 / 1280 폭에서 탭·카드가 넘치지 않는다.

- [ ] **Step 10: 커밋**

```bash
git add src/app/my src/components/payments src/lib/payments
git commit -m "feat: 마이 페이지 3탭과 결제 취소

탭 전환을 ?tab= 쿼리로 서버에서 한다. 세 탭의 출처가 모두 달라, 클라이언트에서
바꾸면 안 보는 목록까지 매번 내려보내야 한다.

취소 모달의 환불 금액은 서버가 계산해 내려준다. 확정은 액션이 서버 시각으로
다시 계산하고, 모달의 숫자는 표시용이다."
```

---

### Task 9: 전체 검증과 문서

**Files:**
- Modify: `README.md` (화면 표 · npm 스크립트 표)
- Modify: `docs/superpowers/specs/2026-08-17-meeting-payment-handoff-design.md` (구현 중 확정된 차이 한 줄)

**Interfaces:**
- Consumes: Task 1~8 전부
- Produces: 없음 (검증과 문서)

- [ ] **Step 1: 전체 검사를 돌린다**

```bash
npm run check:refund
npx tsc --noEmit
npx eslint . --max-warnings=0
npm run build
npm run build-storybook
```

Expected: 다섯 개 모두 통과. `next build`가 새 라우트 3개(`/meetings/[id]`,
`/payments/[orderNo]`, 갱신된 `/my`)를 동적 렌더로 잡는다.

- [ ] **Step 2: 보안 어드바이저**

MCP `get_advisors({ type: "security" })`
Expected: 새 경고 없음. 남아 있는 항목이 있으면 이번 작업과 무관한 기존 항목인지 확인한다.

- [ ] **Step 3: 브라우저 확인 — 폭**

`npm run dev` 후 390 / 834 / 1280 폭에서 `/`, `/meetings/{id}`, `/meetings/{id}?pay=1`,
`/payments/{orderNo}`, `/my`, `/my?tab=payments`, `/my?tab=cancels`,
`/my?tab=payments&cancel={id}`를 본다.

- 가로 스크롤이 생기지 않는다.
- 1280을 넘는 폭에서 본문이 1280(읽기 화면은 800, 완료 화면은 640)에서 멈춘다.
- 내비게이션 표면이 정확히 하나다(폰은 하단 탭 또는 흐름 상단 바, md부터 상단 헤더).
- 시트는 폰에서 아래, md부터 가운데. 모달은 모든 폭에서 가운데.

- [ ] **Step 4: 브라우저 확인 — 분기**

| 확인 | 방법 | 기대 |
|---|---|---|
| 정원 마감 | `update meeting set capacity = 1` 후 다른 계정으로 결제 시도 | CTA가 `정원 마감`, 시트로 못 들어간다 |
| 모집 종료 | `update meeting set closes_at = now() - interval '1 day'` | CTA가 `모집 종료`, 배너에서도 내려간다 |
| 이미 결제 | 결제 후 상세 재방문 | CTA가 `결제 내역 보기` |
| 중복 결제 | 결제 완료 화면 새로 고침 · 뒤로 갔다 다시 오기 | `payment` 행이 늘지 않는다 |
| 시트 실패 문구 | 결제 직전에 다른 창에서 정원을 채운 뒤 결제 | 시트가 닫히지 않고 `결제 중 자리가 마감되었어요` |
| 환불 불가 | 8/19 모임 결제 후 결제 내역 | 버튼 대신 `환불 기간 종료` |
| 50% 환불 | 8/22 모임 결제 후 취소 | 모달이 `모임 3~7일 전 (50%)`, 환불 예정 금액이 절반 |
| 남의 주문 | 다른 계정의 `order_no`로 `/payments/…` 접속 | 404 |
| 비로그인 | 로그아웃 후 `결제하기` → 로그인 → 돌아옴 | 시트가 열린 상세로 돌아온다 |

확인용으로 바꾼 행은 원래 값으로 되돌린다.

- [ ] **Step 5: `README.md`를 갱신한다**

화면 표에 세 줄을 넣는다(`/restaurants/[id]/edit` 아래, `/my` 위).

```markdown
| `/meetings/[id]` | 모임 상세. 일시·장소·정원·환불 규정과 하단 결제 바 |
| `/meetings/[id]?pay=1` | 결제 바텀시트(인원 선택·동의·결제) |
| `/payments/[orderNo]` | 결제 완료. 주문번호로 조회하므로 새로 고쳐도 재결제가 없다 |
```

`/my` 줄을 고친다.

```markdown
| `/my` | 내 프로필. `내가 쓴 글` · `결제 내역` · `취소 내역` 3탭 (`?tab=`) |
```

npm 스크립트 표에 한 줄 넣는다.

```markdown
| `npm run check:refund` | 환불 비율 경계값 확인 (`src/lib/payments/refund.ts`) |
```

`### 3. Supabase 준비`에 모임·결제 테이블이 마이그레이션으로 들어간다는 문장과, 상품은
어드민 없이 SQL로 넣는다는 한 줄을 더한다.

- [ ] **Step 6: 스펙에 확정된 차이를 한 줄 더한다**

`docs/superpowers/specs/2026-08-17-meeting-payment-handoff-design.md`의 "의도적으로
다르게 한 항목"에 추가한다.

```markdown
- **취소 내역의 적용 규정 문구** — 시안은 이 자리에만 `3~7일 전 취소 (50%)`로 쓰지만,
  규정 문구는 네 화면이 같아야 하므로 규정 표와 같은 `모임 3~7일 전 (50%)`으로 통일한다.
- **취소 모달 제목 크기** — 시안은 20px(heading-md), DS `Modal`의 제목은 16px
  (heading-sm)이다. 모달 한 곳을 위해 DS 컴포넌트의 제목 규격을 바꾸지 않는다.
- **미니 지도 높이 120 → 150** — `NaverMap`의 `sm` 규격을 그대로 쓴다. 임의값
  클래스로 덮으면 두 `h-[…]` 중 어느 것이 이길지 보장되지 않는다.
- **결제 버튼 높이 50 → 48** — 버튼 스케일은 32/40/48뿐이다. 스케일 밖 크기를
  만들지 않는다.
```

- [ ] **Step 7: 커밋**

```bash
git add README.md docs/superpowers/specs/2026-08-17-meeting-payment-handoff-design.md
git commit -m "docs: 결제 화면 라우트와 확인 스크립트를 README에 반영

구현 중 확정된 시안 대비 차이 네 건을 스펙에 적었다."
```

---

## 완료 조건

- [ ] 8개 화면이 모두 동작한다: 메인 배너(캐러셀·자동 넘김·점), 모임 상세(상태별 CTA),
      결제 시트(인원·동의·실패 문구), 결제 완료(주문번호 조회), 마이 3탭, 취소 모달.
- [ ] `npm run check:refund` 21개 통과 — 168h·72h 경계 포함.
- [ ] `tsc --noEmit` · `eslint . --max-warnings=0` · `next build` · `build-storybook` 통과.
- [ ] `get_advisors({ type: "security" })`에 새 경고 없음.
- [ ] 정원 초과 판매가 불가능하다 — 두 창에서 마지막 자리를 동시에 결제하면 한쪽만 성공한다.
- [ ] 같은 사람이 같은 모임을 두 번 결제할 수 없다(유니크 인덱스 + CTA).
- [ ] 결제 완료 화면을 새로 고쳐도 `payment` 행이 늘지 않는다.
- [ ] 환불 금액이 서버 시각으로 계산되고, 규정 문구가 네 화면에서 같다.
- [ ] DS 변경 4건(Badge 톤·TabNavigation 변형·시트/모달 오버레이·Stepper)에 스토리가 있다.
- [ ] 390 / 834 / 1280 폭에서 가로 스크롤이 없고 내비게이션 표면이 하나다.

