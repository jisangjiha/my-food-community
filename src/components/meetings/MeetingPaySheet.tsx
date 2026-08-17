"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { formatWon } from "../../lib/meetings/format";
import { payMeeting, type PayFormState } from "../../lib/payments/actions";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Stepper } from "../ui/Stepper";

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
 * 결제 바텀시트 — design.pen `06b Payment Bottom Sheet`.
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
        <span className="type-heading-md text-text-default">
          {formatWon(total)}
        </span>
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
