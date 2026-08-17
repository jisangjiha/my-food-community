# 유료 모임 결제 핸드오프 (F~J)

작성일: 2026-08-17

## 배경

design.pen에 결제 흐름 화면 8장이 새로 그려졌고, `02-prd.md`가 그 기획(§7.2 F~K,
환불 규정)을 담고 있다. 지금 앱에는 상품·주문 개념이 없다. `place`·`place_image`·
`profile` 세 테이블뿐이고, 메인 상단 배너 자리에는 "가장 최근 맛집 글"이 서 있다.

이번 작업은 그 8장을 Next.js로 옮기면서 모임 상품과 결제·취소를 실제로 동작하게
만든다. 결제 대행사(PG)는 붙이지 않는다 — 서버가 주문을 만들고 즉시 승인 처리하는
모의 결제다. 카드사 승인·웹훅·좌석 임시 홀드는 PG가 없으면 흉내만 남으므로 넣지
않는다. 그 대신 **정원 초과 판매와 금액 불일치는 실제로 막는다**(PRD KR10).

## 범위

| 화면 | Pencil 노드 | 경로 |
|---|---|---|
| 메인 상단 배너 | `PIMD0` 안 `veEFZ` + dots `HMk1c` | `/` |
| 모임 상세 | `W2l7Ei` | `/meetings/[id]` |
| 결제 바텀시트 | `P7QTKc` 안 `OQqXe` | `/meetings/[id]?pay=1` |
| 결제 완료 | `R4Zpw` | `/payments/[orderNo]` |
| 마이 · 내가 쓴 글 | `Tstm6` | `/my` (= `?tab=posts`) |
| 마이 · 결제 내역 | `n9ROBu` | `/my?tab=payments` |
| 마이 · 취소 내역 | `JAeZM` | `/my?tab=cancels` |
| 결제 취소 모달 | `L1GGQ3` 안 `BtYry` | `/my?tab=payments&cancel=<id>` |

범위 밖: 운영자 어드민(PRD K, 디자인 없음), 부분 취소, PG 연동, 결제 완료 메일,
배너 노출 기간 컬럼, 상품 이미지 여러 장.

## 결정과 근거

### 1. 정원과 금액은 SQL이 원자적으로, 환불 규정은 TS가 단독으로

두 규칙을 같은 곳에 두려 했으나 요구가 서로 다른 방향을 가리킨다.

**정원·금액은 SQL.** `pay_meeting(모임id, 인원)` plpgsql 함수가 한 트랜잭션 안에서
모임 행을 `for update`로 잠그고 → 팔린 자리를 합산해 검사 → **DB에 있는 가격으로
총액을 계산** → 주문번호를 만들어 `payment`를 삽입한다. "확인 후 차감"을 두 문장으로
나누면 마지막 한 자리를 두 사람이 동시에 사는 사고가 난다(PRD 7.3). 총액을 서버
코드가 계산해 넘기지 않고 SQL이 직접 계산하므로, 클라이언트가 보낸 금액이 끼어들
자리가 애초에 없다.

**환불 비율은 TS.** `src/lib/payments/refund.ts`에 규정 표와 판정 함수를 두고
`npm run check:refund`로 경계값을 검증한다. 이 저장소에는 테스트 러너가 없고
(`check:parse`·`check:address`가 같은 처지다) 환불 비율은 조용히 틀리는 종류의
코드다. 남은 시간이 정확히 168시간일 때 100%에 포함되는지는 눈으로 검증할 수 없고,
SQL에 두면 오프라인에서 확인할 방법이 없다. 규정 문구가 배너 상세·시트·완료 화면·
취소 모달 네 곳에서 같아야 한다는 요구(PRD 340)도 TS 상수 하나에서 문구를 뽑는 쪽이
지키기 쉽다.

경계는 이렇게 갈린다: **금액을 정하는 것은 SQL, 비율을 정하는 것은 TS.** 취소는
서버가 TS로 비율을 계산해 `cancel_payment(주문id, 환불액, 비율, 규정키)`에 넘기고,
SQL은 소유권·상태·`환불액 <= 결제액`만 다시 확인한 뒤 기록한다. 브라우저는 Supabase에
닿을 수 없으므로(publishable 키가 서버 전용) 이 인자는 서버가 만든 값이다.

### 2. 남은 자리는 computed column으로 읽는다

`payment`는 RLS로 자기 행만 보인다. 그래서 목록·상세에서 `select sum(headcount)`을
하면 남의 결제가 빠진 수를 정원으로 착각한다. 뷰로 우회하면
`security_definer_view` 어드바이저에 걸린다. PostgREST의 computed column —
`seats_taken(meeting) returns int`를 `stable security definer set search_path = ''`로
선언하고 `select("id, title, ..., seats_taken")`으로 읽는다. 노출되는 것은 집계값
하나뿐이고, 개별 결제 행은 여전히 RLS 뒤에 있다.

### 3. 중복 결제는 유니크 인덱스가 막는다

`(user_id, meeting_id) where status = 'paid'` 부분 유니크 인덱스를 둔다. 결제 버튼
연타·네트워크 재시도로 같은 요청이 두 번 들어와도 두 번째는 DB에서 튕긴다. 이 제약은
PRD의 "이미 결제한 상품 → `결제 내역 보기`" 규칙과 정확히 같은 사실을 말하므로,
상세 화면의 버튼 상태와 DB 제약이 어긋날 수 없다. 부분 취소가 범위 밖이라 한 사람이
한 모임에 결제를 두 번 나눠 할 이유도 없다.

### 4. 시트와 모달의 열림 상태를 URL에 둔다

`/meetings/[id]?pay=1`, `/my?tab=payments&cancel=<id>`.

비로그인 사용자가 `결제하기`를 누르면 로그인으로 보내고 끝난 뒤 **이 화면으로
되돌아와야** 한다(PRD 276). 열림 상태가 컴포넌트 안의 `useState`면 돌아온 자리에서
시트가 닫혀 있고, 사용자는 방금 누른 버튼을 다시 찾아 눌러야 한다. 쿼리에 두면
`next=/meetings/{id}?pay=1` 한 줄로 끝난다.

취소 모달도 같다. 모달은 **환불 예정 금액**을 보여줘야 하는데(PRD 315) 그 값은 서버가
계산한다. 쿼리로 열면 서버 컴포넌트가 그 건을 조회해 확정된 금액과 함께 렌더할 수
있고, 클라이언트가 금액을 다시 계산하는 코드가 사라진다.

### 5. 결제 완료는 주문번호로 조회하는 화면이다

`/payments/[orderNo]`. 서버 액션이 결제 후 이 경로로 `redirect`한다. 화면은 주문을
조회해 그릴 뿐이라 새로 고치거나 뒤로 갔다 다시 와도 결제가 다시 일어나지 않는다
(PRD 299). 남의 주문번호를 넣으면 RLS가 걸러 404다 — "권한 없음"과 "없는 주문"을
구분해 알려 주면 주문번호의 존재 여부가 새기 때문이다.

### 6. 마이 페이지는 3탭으로 바꾼다

`내가 쓴 글` · `결제 내역` · `취소 내역`(PRD 304). 시안이 엇갈린다 — `Tstm6`은 아직
`내가 쓴 글` · `저장한 곳` 2탭이고 신규 `n9ROBu`·`JAeZM`는 3탭 밑줄 탭이다. 신규
쪽을 따르고 `저장한 곳`은 내린다. 저장 기능이 없어 눌러도 벽이고, 죽은 탭은 없는
기능이 있는 척을 한다.

탭 전환은 `?tab=`으로 서버에서 한다. 세 탭의 데이터 출처가 모두 다르고(글 / 결제 /
취소), 클라이언트에서 전환하면 세 목록을 한꺼번에 내려보내야 한다.

### 7. 환불 상태는 시각으로 정한다

취소 내역의 배지는 `환불 처리 중` / `환불 완료` 두 가지다(디자인 `M0cb4`). 모의
결제에서 환불이 즉시 끝나면 `환불 처리 중`은 화면에 영원히 나타나지 않고, 탭 상단의
"카드 환불은 3~5일 걸릴 수 있어요" 안내가 거짓이 된다. 취소 시
`refund_completes_at = canceled_at + 3일`을 적고, 그 시각을 지나면 `환불 완료`로
읽는다. 안내 문구와 화면이 같은 말을 한다.

## 아키텍처

```
src/
  app/
    page.tsx                        상단에 MeetingBanner 추가
    meetings/[id]/page.tsx          모임 상세 + ?pay=1 시트
    payments/[orderNo]/page.tsx     결제 완료
    my/page.tsx                     3탭 + ?cancel=<id> 모달
  components/
    meetings/
      MeetingBanner.tsx             (client) 캐러셀
      MeetingPaySheet.tsx           (client) 인원·동의·결제
      MeetingInfoCard.tsx           일시·장소·지도·가격·정원·마감
      RefundPolicyTable.tsx         환불 규정 표 (상세·완료 공용)
    payments/
      PaymentHistoryCard.tsx        결제 내역 카드
      CancellationCard.tsx          취소 내역 카드
      CancelPaymentModal.tsx        (client) 취소 확인
    ui/
      Badge.tsx                     tone="soft" 추가
      Navigation.tsx                TabNavigation variant="inline" 추가
      BottomSheet.tsx / Modal.tsx   floating 오버레이 모드 추가
      Stepper.tsx                   신규 (−/+ 인원 선택)
  lib/
    meetings/{dto.ts,service.ts,format.ts}
    payments/{dto.ts,service.ts,actions.ts,refund.ts}
scripts/refund-check.mts            npm run check:refund
```

Supabase를 아는 코드는 `lib/*/service.ts`까지다. 화면은 DTO만 받는다. 변경은 서버
액션 두 개(`payMeeting`, `cancelPayment`)뿐이고 새 Route Handler는 만들지 않는다 —
읽기는 서버 컴포넌트가 서비스 함수를 직접 부르는 기존 방식을 따른다.

### 데이터

`meeting`

| 열 | 비고 |
|---|---|
| `title`, `category_label`, `summary`, `description` | `category_label`은 시안의 `이웃 모임 · 맛집 투어` |
| `image_url` | null 허용. 없으면 시안의 아이콘 자리표시자를 그린다 |
| `address`, `lat`, `lng` | 좌표가 있을 때만 지도를 그린다 (맛집 상세와 같은 규칙) |
| `price`, `capacity`, `max_per_person` | 1인 가격, 최대 참여 가능 수, 1인당 최대 매수(기본 4) |
| `starts_at`, `closes_at` | 모임 시작, 모집 마감 |
| `status` | `on_sale` / `hidden` / `closed` |
| `display_order` | 배너 정렬 |

`payment`

| 열 | 비고 |
|---|---|
| `order_no` | unique. `PMT-20260817-0421` 형식 — 날짜(KST) + 시퀀스 4자리 |
| `meeting_id`, `user_id`, `headcount`, `amount` | `amount`는 SQL이 계산 |
| `method` | 모의 결제라 `카드` 고정 |
| `status` | `paid` / `canceled` |
| `paid_at`, `canceled_at` | |
| `refund_amount`, `refund_rate`, `refund_rule` | 취소 시점에 확정해 적는다 |
| `refund_completes_at` | `canceled_at + 3일` |

RLS — `meeting`: 읽기 `using (true)`(비로그인도 배너·상세를 본다), 쓰기 정책 없음.
`payment`: 읽기 `(select auth.uid()) = user_id`, 쓰기 정책 없음. 모든 쓰기는
`security definer` 함수를 지난다. 함수는 `revoke execute ... from public` 후
`anon, authenticated`에만 허용하고 `set search_path = ''`를 붙인다.

### 환불 규정 (PRD 확정, 모임 시작 시각 기준)

| 취소 시점 | 비율 | 규정키 | 문구 |
|---|:---:|---|---|
| 시작 168시간(7일) 전까지 | 100% | `over_7d` | 모임 7일 전까지 |
| 시작 72~168시간 전 | 50% | `between_3_7d` | 모임 3~7일 전 |
| 시작 72시간(3일) 이내 | 0% | `within_3d` | 모임 3일 이내 |

경계는 "이상"이 유리한 쪽에 붙는다 — 남은 시간이 정확히 168시간이면 100%,
정확히 72시간이면 50%다. 기준 시각은 서버 시각이다.

### 상세 화면의 CTA 상태 (PRD 269)

| 조건 | 버튼 |
|---|---|
| 판매 중 | `결제하기` |
| 남은 자리 0 | `정원 마감` (비활성) |
| 모집 마감 지남 / `status != on_sale` | `모집 종료` (비활성) |
| 이미 결제 | `결제 내역 보기` → `/my?tab=payments` |
| 비로그인 | `결제하기` → `/login?next=/meetings/{id}?pay=1` |

## 에러 처리

`pay_meeting`·`cancel_payment`는 사유를 코드로 던지고, 서비스가 그것을 사용자 문구로
바꾼다. Supabase 원본 에러는 로그에만 남는다.

| 코드 | 화면 |
|---|---|
| `SOLD_OUT` | "결제 중 자리가 마감되었어요" — 시트를 닫지 않고 그 자리에 표시(PRD 291) |
| `ALREADY_PAID` | "이미 결제한 모임이에요" + 결제 내역 링크 |
| `CLOSED` | "모집이 종료되었어요" |
| `HEADCOUNT` | "신청 가능한 인원을 확인해 주세요" |
| `NO_REFUND` | "환불 가능 기간이 지났어요" |
| `NOT_FOUND` | 404 |

빈 상태는 기존 `Empty`를 쓴다 — 결제 내역 "아직 결제한 모임이 없어요"(+ 메인 링크),
취소 내역 "취소한 내역이 없어요".

## 반응형

design.pen은 360px만 그린다. 기존 계약(`PageContainer`, 하단 탭 ↔ 상단 헤더 배타)을
그대로 쓰고, 화면별 확장은 다음과 같다.

| 화면 | 모바일 | md 이상 |
|---|---|---|
| 배너 | 1장 캐러셀 + dots | 컨테이너 폭까지 늘어나고 타입이 승급된다. 장수·dots는 같다 |
| 상세 | 읽기 폭, 하단 고정 Pay Bar | 읽기 폭 800 유지, Pay Bar는 800에 맞춰 중앙 정렬된 채 계속 하단 고정 |
| 시트 | 하단 바텀시트 | 중앙 다이얼로그(최대 480), 모서리 전체 radius |
| 완료 | 폼 폭 | 최대 640 |
| 마이 | 3탭 밑줄 | 내 글은 1280 그리드, 결제·취소 목록은 800 |
| 취소 모달 | 좌우 24 여백 | 최대 360 중앙 |

Pay Bar를 lg에서 우측 sticky 레일로 분리하는 안은 버렸다. 결제 CTA는 상시 보여야
하고(PRD 268), 폭에 따라 CTA 자리가 옮겨 다니면 같은 흐름이 화면마다 달라 보인다.
기존 맛집 상세도 레일 없이 읽기 폭 하나로 정리되어 있다.

## 디자인 시스템에 가하는 변경

1. **`Badge`에 `tone="soft"`** — 시안의 상태 칩(`참여 예정`·`환불 완료`·`환불 처리 중`)은
   채워진 배경(brand-subtle / success / warning / subtle)이고 기존 Badge는 외곽선형이다.
   기존 외곽선이 기본값이고 `soft`가 추가 톤이다.
2. **`TabNavigation`에 `variant="inline"`** — 신규 시안의 탭은 gap 24, 배경 없음,
   선택 탭 아래 2px 밑줄이다(높이 30). 기존 48px 등분 탭은 `variant="filled"` 기본값으로 남는다.
3. **`BottomSheet`·`Modal`에 `floating`** — 지금은 스토리에서 보이도록 인라인 렌더다.
   `fixed` 오버레이 + Esc 닫기 + 스크롤 잠금을 옵션으로 넣는다. 훅을 쓰므로
   `"use client"`가 붙는다. 기존 스토리의 사용법은 그대로 동작한다.
4. **신규 `Stepper`** — 32px 정사각 −/+ 버튼과 숫자, 상한에서 `+` 비활성. 기존
   컴포넌트로 표현할 수 없어 새로 만들고 `src/stories/ui/Handoff.stories.tsx`에 스토리를 넣는다.

네 항목 모두 스토리를 같은 커밋에서 갱신한다.

## 시안을 그대로 따른 항목

- 카드·시트·모달의 치수·간격·radius·토큰은 시안 값 그대로다(정보 카드 padding 16 /
  gap 12, 시트 padding `[10,16,20,16]` / gap 14, 스테퍼 32px / gap 14, 모달 폭 312 /
  padding 20 / gap 16).
- 문구는 시안 그대로 옮긴다 — `1인 25,000원 × 2명`, `환불 규정을 확인했습니다`,
  `모임 시작 시각(KST) 기준으로 계산됩니다.`, `카드 환불은 카드사 사정으로 3~5일 걸릴 수 있어요.`
- 환불 규정 표의 4행 구조와 색(100% success / 50% default / 환불 불가 error).
- 결제 완료 화면의 성공 원형(72px, background-success + check/32).

## 의도적으로 다르게 한 항목

- **결제 수단 `카드 · 신한` → `카드`** — 카드사 이름은 PG가 주는 값이다. 모의
  결제에서는 알 수 없으므로 아는 것만 적는다.
- **동의 체크박스** — 시안은 체크박스 자체 라벨(`동의합니다`)과 옆 텍스트
  (`환불 규정을 확인했습니다`)를 겹쳐 뒀다. DS `Checkbox`의 라벨 하나로 합친다.
- **미니 지도** — 시안은 지도 이미지를 붙였지만 맛집 상세와 같은 `NaverMap`(static)을
  쓴다. 좌표가 없으면 지도를 그리지 않는다.
- **배너 히어로 이미지** — 시안은 Unsplash 원본 URL을 가리킨다. 그 파일을
  `public/images/`로 받아 로컬 경로로 쓴다. 외부 호스트가 사라지면 배너가 깨진다.
- **하단 홈 인디케이터 pill 제외** — OS 크롬이지 앱 UI가 아니다. 기존 화면과 같다.
- **`저장한 곳` 탭 제거** — 위 결정 6.

## 시드 데이터

배너 dots 3개와 맞추고, 환불 3구간을 실제로 밟아 볼 수 있게 날짜를 잡는다.

| 모임 | 시작 | 가격 | 정원 | 환불 구간 |
|---|---|---|---|---|
| 구로 골목 맛집 투어 | 2026-12-14 14:00 | 25,000 | 20 | 100% |
| 사진 잘 찍는 법 클래스 | 2026-08-22 15:00 | 30,000 | 12 | 50% |
| 원데이 베이킹 클래스 | 2026-08-19 19:00 | 40,000 | 10 | 환불 불가 |

결제·취소 내역은 시드하지 않는다. 주문의 주인은 로그인한 사용자이고, 마이그레이션은
그 사용자가 누구인지 모른다. 위 3건으로 결제·취소를 직접 해 보면 세 구간이 모두
채워진다.

## 검증

- `tsc --noEmit`, `eslint --max-warnings=0`, `next build`, `build-storybook`
- `npm run check:refund` — 환불 비율 경계값(168h·72h 정확히, 그 앞뒤 1분)
- `get_advisors({ type: "security" })` — 마이그레이션 후
- 브라우저 390 / 834 / 1280 폭 × `/`, `/meetings/[id]`, 시트, `/payments/[orderNo]`,
  `/my` 3탭, 취소 모달: 가로 스크롤 없음, 내비게이션 표면 1개, 1280 상한 유지
- 분기 확인: 정원 마감 · 이미 결제 · 모집 종료 · 환불 불가 · 비로그인 결제 시도 후
  로그인 왕복

## 후속

- PG 연동 시 되살릴 것: 10분 좌석 홀드, 웹훅, 멱등키, 결제 실패·만료 상태,
  부분 환불.
- 운영자 어드민(PRD K)이 없어 상품 등록·마감은 SQL로 한다. 모임을 지속적으로 열면
  가장 먼저 필요해질 화면이다.
- `저장한 곳`은 저장 기능이 생기는 날 탭으로 돌아온다.
