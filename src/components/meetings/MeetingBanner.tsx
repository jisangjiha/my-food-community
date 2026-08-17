"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { MeetingBannerItem } from "../../lib/meetings/dto";
import { formatMeetingShort, formatWon } from "../../lib/meetings/format";

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
      const next =
        (Math.round(track.scrollLeft / track.clientWidth) + 1) % meetings.length;
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
        <div
          className="flex justify-center gap-[5px]"
          role="tablist"
          aria-label="모임 배너"
        >
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
                dot === index
                  ? "w-4 bg-background-brand"
                  : "w-1.5 bg-border-default"
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
        {/*
          시안의 태그 문구는 "이번 주 모임"이다. 상품마다 다른 문구를 하드코딩할 수
          없어 `category_label`의 앞 조각(`이웃 모임`)을 쓴다. 뒤 조각은 상세의
          눈썹에서 다시 보인다.
        */}
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
