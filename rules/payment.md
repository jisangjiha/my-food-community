# 결제 규칙 (SSOT)

결제·웹훅·취소·환불의 단일 기준. 코드보다 이 문서가 먼저다. 어긋나면 둘 중 하나를
고친다. PG는 **포트원 V2**다 — V1 문서를 보지 않고, 코드를 쓰기 전에 PortOne MCP로
스펙을 확인한다(`listPortoneDocs` → `readPortoneV2FrontendCode` / `…BackendCode`).

## 1. 절대 규칙 — 깨면 돈이 틀어진다. 예외 없다

1. **금액의 출처는 언제나 DB다.** 클라이언트가 보낸 금액으로 무엇도 결정하지 않는다.
2. **바깥에서 온 결과를 믿지 않는다.** 리다이렉트도 웹훅 본문도 마찬가지다. 서버가
   포트원에 **다시 조회해서** 확인한 것만 사실이다.
3. **소유자를 클라이언트가 정하지 않는다.** 세션이 있으면 `auth.uid()`, 없는 웹훅만 §4.2.
4. **비밀값은 브라우저에 닿지 않는다.** `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
5. **PG 원본 에러를 사용자에게 노출하지 않는다.** 로그에만 남긴다.
6. **기록은 멱등하다.** 같은 결제 건이 몇 번 들어와도 결제 행은 하나이고, 같은 취소
   내역이 몇 번 들어와도 취소 행은 하나다.
7. **원장은 append-only다.** 취소도 새 행으로 쌓는다. 지우거나 덮어쓰지 않는다.
8. **Supabase 호출은 BFF에서만.** CLAUDE.md의 데이터 접근 규칙을 따른다.

## 2. 식별자

- `paymentId` — 결제 건 ID. 브라우저가 결제를 누르는 순간 `crypto.randomUUID()`로
  만드는 **UUID v4**이고, **주문번호이자 원장의 그룹키**다. 셋을 분리하지 않는다 —
  사용자가 부르는 번호로 포트원 콘솔에서 바로 찾을 수 있어야 한다. 결제 버튼을 다시
  누르면 새로 만든다. 실패한 건의 ID를 재사용하지 않는다.
- `transactionId` — 포트원이 채번한 **시도** 번호. 시도마다 달라진다. 스냅샷에만 남긴다.
- `cancellationId` — 포트원이 채번한 **취소 내역** 번호. **취소 행의 멱등 키**다.
  `transaction_key`만으로는 취소 행을 구분할 수 없다(부분 취소가 여러 번일 수 있다).
- `storeId` / `channelKey` — 비밀값 아님. 그래도 `NEXT_PUBLIC_` 금지(§7).

## 3. 흐름

```
결제
ProductPayBar ─requestPayment(forceRedirect)─▶ PG 결제창 ─┬─ 리다이렉트 ▶ GET  /api/payments/complete  confirmPayment()
                                                          └─ 포트원 서버 ▶ POST /api/payments/webhook  recordWebhookPayment()
성공 → 303 /payments/[paymentId] · 실패 → 303 /payments/failed?reason=…

취소
CancelPaymentButton ▶ POST /api/payments/[paymentId]/cancel  cancelMyPayment()
                          └ 포트원 취소 API ─▶ 재조회 검증 ─▶ 원장
                                └ 포트원 서버 ▶ POST /api/payments/webhook  recordWebhookCancellation()
```

문이 넷이고 둘씩 짝을 이룬다. 각 짝은 **소유자를 정하는 방법만** 다르고, 검증(§5)과
기록(§4.1)은 한 벌을 공유한다. 갈라 두면 한쪽에만 검사를 추가하는 날이 온다. 결제와
취소도 §5의 교차검증을 통째로 공유하며, 다른 것은 "포트원이 말하는 상태" 한 줄뿐이다.

확정은 **Route Handler 또는 서버 액션에서만** 한다 — 서버 컴포넌트에서 하면 새로고침·
뒤로가기·프리페치가 전부 확정을 다시 태우는 경로가 된다.

### 3.1 결제창 호출

- 결과는 **리다이렉트로만** 받는다(`redirectUrl` + `forceRedirect: true`). 반환값과
  섞으면 완료 처리가 두 벌이 되고 모바일에서 결제 UI가 깨진다.
- `redirectUrl`은 절대 URL. **`window.location.origin`을 쓴다.** 환경변수도 쿼리스트링도 없다.
- `customData`에는 최소한만(`productId`, `userId`). **금액을 넣지 않는다** — 넣으면 언젠가
  그것을 근거로 쓰는 코드가 생긴다.

### 3.2 웹훅

리다이렉트가 도달하지 못한 결제와, 우리 화면을 거치지 않은 취소를 건져 내는 자리다.
결제와 취소가 **같은 엔드포인트 하나**로 들어온다 — 서명 검증과 raw body 규칙이 같고,
문을 나누면 한쪽에만 검사를 추가하는 날이 온다.

- **서명 검증이 먼저다.** `@portone/server-sdk/webhook`의 `verify(secret, body, headers)`.
  검증 전에는 본문의 어떤 값도 신뢰하지 않는다.
- **본문은 raw text로 읽는다**(`await request.text()`). 파싱 후 다시 문자열로 만들면 서명이 깨진다.
- 웹훅이 알려 주는 것은 `paymentId`와 `cancellationId`까지다. **상태는 조회 API로 다시
  확인한다**(§5).
- 처리하는 `type`은 둘이다 — `Transaction.Paid`와 `Transaction.Cancelled`(전액 취소).
  `Transaction.PartialCancelled`·`Transaction.CancelPending`은 무시하고 200이다. 앞은
  우리가 만들지 않는 상태이고, 뒤는 아직 돈이 돌아가지 않은 상태다(완료되면
  `Transaction.Cancelled`로 다시 온다).
- **모르는 `type`은 무시하고 200.** 포트원은 예고 없이 이벤트를 추가한다.
- **200 전에 처리를 끝낸다.** 먼저 200을 주면 실패해도 재시도를 받을 방법이 없다.
- 웹훅과 리다이렉트가 **동시에 같은 건을 확정하려 들 수 있다.** §1-6이 감당한다.
- 상태 코드는 사용자가 아니라 **포트원에게 하는 말**이다. 서명 검증 실패는 `400`,
  처리 완료·모르는 이벤트는 `200`, 나머지는 §5의 재시도 열을 따른다. 결론이 같은
  실패를 `500`으로 답하면 로그만 다섯 배가 되고(재전송 최대 5회, backoff), 일시적
  실패를 `200`으로 닫으면 돈은 받았는데 주문이 없는 상태가 굳는다.

## 4. 데이터 — `payment`은 결제와 취소가 함께 쌓이는 insert-only 원장이다

| 열 | 값 |
| --- | --- |
| `id` (uuid, PK) | 원장 행 하나의 식별자. 행마다 새로 채번 |
| `transaction_key` (uuid, not null) | **그룹키 = `paymentId`.** 결제와 그에 딸린 취소들이 공유 |
| `type` (text, not null) | `PAYMENT` \| `CANCEL` |
| `amount` (numeric, not null) | **`PAYMENT`는 +, `CANCEL`은 −.** 그룹 합계가 남은 결제액 |
| `cancellation_id` (uuid) | **`CANCEL`의 멱등 키.** `PAYMENT`에는 없다 |
| `product_id`, `user_id` | 소유자는 §4.2가 정한다. 취소 행은 **원 결제 행에서 복사**한다 |
| `payment_snapshot_id` | 아래 스냅샷 |

DB가 강제한다. 애플리케이션 검사는 최적화일 뿐이고 보장은 여기다.

- `payment_amount_sign` — 부호가 곧 방향. 어긋난 행은 들어가지 않는다.
- `payment_one_payment_per_key` — `transaction_key`당 `PAYMENT` 행 하나(부분 unique).
  **중복 결제의 최종 방어선.** 웹훅과 리다이렉트가 같은 순간에 들어와도 하나만 산다.
- `payment_one_cancel_per_cancellation` — `cancellation_id`당 행 하나(부분 unique).
  **중복 취소의 최종 방어선.** 웹훅과 사용자 요청이 같은 순간에 들어와도 하나만 산다.
- `payment_cancellation_id_shape` — `CANCEL`은 멱등 키를 반드시 갖고, `PAYMENT`는 갖지
  않는다. 열의 유무도 부호처럼 행의 종류를 따라간다.

`payment_snapshot` — `snapshot_payment`는 포트원 응답 **원문**, `snapshot_product`는
`product` 행 **원문**(`select *`). DTO가 아니라 행을 넣는다 — 깎으며 버린 컬럼이 나중에
확인하고 싶어지는 바로 그 컬럼이 된다.

### 4.1 쓰기 경로

- `payment`은 **읽기만** 열려 있고(`to authenticated using ((select auth.uid()) = user_id)`)
  insert/update/delete 정책은 **없다.** `payment_snapshot`은 **정책 없음(전면 차단)**.
- 모든 쓰기는 `security definer` 함수를 지난다. `record_payment`와 `record_cancellation`
  둘이다. 각각 중복 확인 → 스냅샷 → 원장 행을 한 트랜잭션에서 처리하고, unique 위반은
  안에서 잡아 기존 행 id를 돌려준다(스냅샷도 함께 롤백되어 고아가 남지 않는다).
- `record_cancellation`은 세 가지를 더 한다. **원 결제 행을 `for update`로 잠그고**
  (동시에 들어온 두 취소가 잔액 검사를 나란히 통과하는 창을 닫는다), **그룹 합계 −
  취소액 ≥ 0**을 확인하고, 취소 행의 `product_id`·`user_id`를 인자가 아니라 **원 결제
  행에서 복사**한다. 취소액은 양수로 받아 함수 안에서 음수로 뒤집는다 — 부호는 원장의
  방향이지 호출자가 정할 값이 아니다.
- **새 결제 쓰기는 정책을 여는 대신 함수를 추가한다.** 규약은 CLAUDE.md 그대로 —
  `set search_path = ''`, 첫 줄에서 소유자 확인, `revoke … from public` + `from anon`,
  필요한 롤에만 `grant`.

### 4.2 소유자

리다이렉트 경로의 소유자는 `auth.uid()`다. 함수가 인자와 대조해 다르면 거절한다.

웹훅에는 세션이 없어 그럴 수 없다. 검증을 통과한 건의 `customData.userId`를 쓰고, §5의
교차검증이 그 값을 붙든다 — `userId`를 바꾸려면 그 사람이 그 상품을 그 금액에 결제한
건이어야 하고, 금액·주문명·채널·상품이 전부 함께 맞아야 통과한다. 이 문은
**`service_role`로만 열린다**(`SUPABASE_SECRET_KEY`). 서비스 롤로 **테이블을 직접 쓰지
않는다** — 반드시 안에서 다시 검사하는 함수만 지난다.

**의도된 경고 세 건**(고치지 않는다): `rls_enabled_no_policy` / `payment_snapshot`,
`authenticated_security_definer_function_executable` / `record_payment` ·
`record_cancellation`.

## 5. 검증

리다이렉트든 웹훅이든, 결제든 취소든 **같은 교차검증**을 지난다. 하나라도 어긋나면
기록하지 않는다.

| 검사 | 막는 것 |
| --- | --- |
| `paymentId`가 UUID v4 | 그룹키가 아닌 값(콘솔 호출 테스트 등) |
| 포트원에 그 건이 있음 | 존재하지 않는 결제 |
| `id === 요청한 paymentId` | 엉뚱한 건을 검사하는 상태 |
| `channel.key === PORTONE_CHANNEL_KEY` | 남의 상점/채널에서 만든 건 |
| `amount.total === product.price` (DB 재조회) | 금액 조작 |
| `currency === "KRW"` | 통화 조작 |
| `orderName === product.name` | 주문명 조작 |
| `customData.userId === auth.uid()` (리다이렉트·사용자 취소만) | 남의 건 가로채기 |

여기에 각자의 상태 한 줄이 붙는다. 이것만이 결제와 취소의 유일한 차이다.

| 결제 | 취소 |
| --- | --- |
| `status === "PAID"` — 미승인·가상계좌 발급 상태를 결제로 기록하는 것을 막는다 | `status === "CANCELLED"` — 전액 취소만 만든다. `PARTIAL_CANCELLED`는 통과시키지 않는다 |
| | `cancellations[]`에 그 `cancellationId`가 있음 — 위조된 취소 내역 아이디 |
| | 그 항목이 `status === "SUCCEEDED"` — 접수만 된 취소(`REQUESTED`)를 환불로 기록 |
| | `totalAmount === product.price` (DB 재조회) — 취소 금액 조작 |

`amount.total`은 취소해도 줄지 않는다(취소 합계는 `amount.cancelled`에 쌓인다). 그래서
취소된 건도 결제와 똑같이 "이 상품을 이 금액에 산 건이 맞는가"를 다시 물을 수 있다.

핵심은 **교차검증**이다. 바깥을 지나온 값들이 서로를 물게 해서, 하나를 조작하면 반드시
다른 하나와 어긋나게 만든다. 상품 조회는 **공개 상태(`status`)를 보지 않는다** — 결제는
이미 일어났고, 그 사이 상품을 내렸다고 기록을 거부하면 돈은 받았는데 주문이 없어진다.

사용자에게는 사유를 **자세히 알려 주지 않는다.** 무엇이 걸렸는지 알려 주면 값을 하나씩
바꿔 가며 통과 조건을 찾을 수 있다. 정확한 사유는 서버 로그에만.

사유 코드는 결제와 취소가 셋(`mismatch`·`unauthorized`·`unavailable`)을 공유하고
나머지는 각자 갖는다. 어휘를 하나로 합치지 않는 이유는 결제 실패 화면 때문이다 — 그
화면은 코드마다 문구를 하나씩 가진 표를 들고 있고, 도달하지 않는 코드까지 섞으면 쓰이지
않는 문구가 쌓인다.

| 코드 | 언제 | 재시도 | 웹훅 응답 |
| --- | --- | --- | --- |
| `canceled` | 결제창에서 중단 | 사용자가 다시 | — |
| `not_paid` | `status !== "PAID"` | 의미 있음 | `500` |
| `not_canceled` | 취소가 아직 반영되지 않음(`REQUESTED` 등) | 의미 있음 | `500` |
| `already_canceled` | 이미 취소된 건에 취소를 걸었다 | 없음 | `200` |
| `mismatch` | 금액·통화·주문명·채널·customData·형식 불일치 | 없음 | `200` |
| `unauthorized` | 세션 없음 / 남의 건 | 없음 | `200` |
| `unavailable` | 포트원 조회·취소 실패, DB 기록 실패 | 의미 있음 | `500` |

`already_canceled`는 사용자에게 사유를 그대로 알려 주는 유일한 코드다. 자기 결제 건의
상태라 숨길 이유가 없고, 오히려 "왜 아무 일도 안 일어나지"를 없앤다.

## 6. 코드 배치

| 역할 | 파일 |
| --- | --- |
| 접속 정보 / REST 호출(유일) / 서명 검증 / 검증·기록·조회 / 타입·상수 | `src/lib/payments/`의 `env` · `portone` · `webhook` · `service` · `dto` |
| 결제창 호출 | `src/components/products/ProductPayBar.tsx` |
| 결제 확정 | `src/app/api/payments/`의 `complete/route.ts` · `webhook/route.ts` |
| 취소 요청(BFF) | `src/app/api/payments/[paymentId]/cancel/route.ts` |
| 취소 버튼·확인 모달 | `src/components/payments/CancelPaymentButton.tsx` |
| 완료 / 실패 화면 | `src/app/payments/`의 `[paymentId]/page.tsx` · `failed/page.tsx` |
| 결제·취소 내역 | `src/app/my/page.tsx` + `src/components/payments/`의 `PaymentHistoryCard` · `CancellationCard` |
| 서비스 롤 클라이언트 | `src/lib/supabase/server.ts` (`createServiceClient`) |

포트원을 아는 코드는 `payments/*`까지다. 라우트와 화면은 DTO만 다룬다. 금액·통화·수단·
취소 사유 문자열은 `payments/dto.ts`의 상수에서만, 금액 표기는 `products/format.ts`의
`formatWon` 하나, 일시 표기는 `payments/format.ts`의 `formatPaymentDateTime` 하나.

## 7. 환경변수

`NEXT_PUBLIC_`을 **붙이지 않는다.** store/channel이 비밀이라서가 아니라, 접두사를 빼 두면
Next.js가 아무 번들에나 값을 인라인하지 않아 값이 나가는 지점이 좁아지기 때문이다.

| 이름 | 성격 | 없으면 |
| --- | --- | --- |
| `PORTONE_STORE_ID` | 공개 | 결제 버튼만 잠기고 상세는 정상 |
| `PORTONE_CHANNEL_KEY` | 공개 | 위와 같음 |
| `PORTONE_API_SECRET` | **비밀** | 결제 확정이 그 자리에서 실패 |
| `PORTONE_WEBHOOK_SECRET` | **비밀** | 웹훅이 500 → 포트원이 재전송 |
| `SUPABASE_SECRET_KEY` | **비밀** | 위와 같음. 리다이렉트 확정은 정상 |

store/channel이 **한쪽만** 있는 상태를 통과시키지 않는다. 그 조합으로 결제창을 열면
포트원이 거절하고, 사용자는 아무 일도 안 일어나는 화면을 본다.

## 8. 취소

- 취소는 **서버에서 포트원 취소 API를 부른 뒤** 결제 건을 다시 조회해 확인한 것만
  기록한다. DB만 바꾸고 포트원에 알리지 않는 "취소"를 만들지 않는다.
- **전액 취소만 한다.** 취소 API에 `amount`를 싣지 않으면 전액이다. 취소 금액도 §1-1을
  따르므로, 기록 전에 DB 상품 가격과 대조한다. 부분 취소를 붙일 때는 이 문서에 먼저
  규칙을 적고 시작한다 — 반쯤 지원하는 취소 코드가 가장 위험하다.
- **취소 가능 조건은 하나다: 그룹 합계 > 0.** 기간·이벤트 날짜로 막지 않는다. 판단은
  화면이 아니라 `record_cancellation`이 하고, 화면의 버튼 상태는 그 결과를 비출 뿐이다.
- `type = 'CANCEL'`, `amount`는 **음수**, `transaction_key`는 **원 결제와 같은 값**,
  `cancellation_id`는 포트원 취소 내역 아이디. 원 결제 행을 지우거나 덮어쓰지 않는다(§1-7).
- 취소 쓰기는 `record_cancellation`을 지난다(§4.1).
- 취소 사유는 사용자에게 입력받지 않는다. 클라이언트가 보낸 문자열을 PG 원장에 그대로
  실어 보낼 이유가 없다. `payments/dto.ts`의 상수 하나를 쓴다.
- **포트원 취소가 성공한 뒤의 실패는 취소의 실패가 아니라 기록의 실패다.** 돈은 이미
  돌아갔으므로 "취소하지 못했다"고 답하면 사용자가 다시 누르고 포트원이 거절한다. 그
  뒤로는 무엇이 실패하든 `pending`으로 답하고, 원장은 취소 웹훅이 마저 적는다.
- `pending`은 실패가 아니다. 취소가 비동기로 처리되는 PG에서 포트원이 접수만 한 상태
  (`REQUESTED`)이며, 원장에는 적지 않는다 — 돌려주기로 한 것과 돌려준 것은 다르다.

## 9. 아직 구현하지 않은 것 — 범위 밖

부분 취소·기간별 환불 비율, 가상계좌(`VIRTUAL_ACCOUNT_ISSUED`), 정기결제·빌링키,
인원 선택·수량, 중복 구매 방지, 에스크로, 현금영수증. 붙일 때는 이 문서에 먼저 규칙을
적고 시작한다.

## 10. 확인

- `npx tsc --noEmit` · `npm run lint` · `npm run build`
- 마이그레이션을 했다면 `get_advisors({ type: "security" })` — 의도된 세 건 외에 새 경고 없음
- 손으로 밟아 볼 결제: 정상 결제 → 완료 화면 **새로고침**(행이 하나인지) → 콘솔에서
  **웹훅 재전송**(그래도 하나인지) → 결제창에서 취소 → 비로그인으로 결제 버튼 → 남의
  `paymentId`로 완료 화면 접근(404) → 서명이 틀린 웹훅(400)
- 손으로 밟아 볼 취소: 마이 페이지 결제 내역에서 취소 → 취소 내역 탭에 한 줄, 결제 내역
  카드는 `취소됨` → **새로고침**(취소 행이 하나인지) → 콘솔에서 **취소 웹훅 재전송**
  (그래도 하나인지) → 같은 건에 취소를 한 번 더(409 `already_canceled`) → 남의
  `paymentId`로 취소 요청(404)
