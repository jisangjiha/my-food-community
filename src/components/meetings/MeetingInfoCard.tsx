import { NAVER_MAP_CLIENT_ID } from "../../lib/maps/env";
import type { MeetingDto } from "../../lib/meetings/dto";
import {
  formatMeetingDateTime,
  formatMeetingDeadline,
  formatWon,
} from "../../lib/meetings/format";
import { DetailRow } from "../ui/DetailRow";
import { NaverMap } from "../ui/NaverMap";

/**
 * 일시·장소·지도·가격·정원·마감 — design.pen `06 Meeting Detail`의 `Info Card`.
 *
 * 지도는 좌표가 있을 때만 그린다. 주소만 있는 상품에 지도를 깔면 화면이 아무 데나
 * 가리키면서 아는 척을 한다(맛집 상세와 같은 규칙).
 *
 * 지도 높이는 시안이 120이지만 `NaverMap`의 `sm`(150)을 그대로 쓴다. 임의값
 * 클래스로 덮으면 Tailwind가 두 `h-[…]` 중 어느 것을 뒤에 놓을지 보장하지 않아
 * 조용히 어긋난다. 앱의 다른 미니 지도와 높이가 같아지는 편이 낫다.
 */
export function MeetingInfoCard({ meeting }: { meeting: MeetingDto }) {
  return (
    <section
      aria-label="모임 정보"
      className="flex flex-col gap-3 rounded-2xl border border-border-default bg-background-surface p-4"
    >
      <DetailRow label="일시">
        {formatMeetingDateTime(meeting.startsAt)}
      </DetailRow>
      <DetailRow label="장소">{meeting.address}</DetailRow>

      {meeting.coords && (
        <NaverMap
          label={meeting.address}
          clientId={NAVER_MAP_CLIENT_ID}
          center={meeting.coords}
          variant="static"
          size="sm"
        />
      )}

      <span aria-hidden className="h-px w-full bg-border-default" />

      <DetailRow label="1인 가격">{formatWon(meeting.price)}</DetailRow>
      <DetailRow label="참여 인원" tone="text-text-brand">
        {`${meeting.seatsTaken}명 / 최대 ${meeting.capacity}명 · 남은 ${meeting.seatsLeft}석`}
      </DetailRow>
      <DetailRow label="모집 마감">
        {formatMeetingDeadline(meeting.closesAt)}
      </DetailRow>
    </section>
  );
}
