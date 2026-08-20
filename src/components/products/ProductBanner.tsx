"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { ProductBannerItem } from "../../lib/products/dto";
import {
  formatCapacity,
  formatProductShort,
  formatWon,
} from "../../lib/products/format";
import { Icon } from "../foundation/Icon";

/** 자동 넘김 간격. */
const AUTO_ADVANCE_MS = 5000;

export interface ProductBannerProps {
  products: ProductBannerItem[];
}

/**
 * 메인 최상단 상품 배너 — design.pen `01b Main Page - Banner`.
 *
 * 가로 스크롤 컨테이너 + scroll-snap으로 만든다. 손가락으로 넘기는 동작을 브라우저가
 * 이미 알고 있어서 터치 이벤트를 직접 다룰 필요가 없고, 키보드 스크롤도 공짜로 온다.
 *
 * 자동 넘김은 5초 간격이며 사용자가 한 번이라도 넘기면 멈춘다.
 * `prefers-reduced-motion`이면 처음부터 넘기지 않는다.
 */
export function ProductBanner({ products }: ProductBannerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const multiple = products.length > 1;

  useEffect(() => {
    if (!multiple || !autoPlay) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const next =
        (Math.round(track.scrollLeft / track.clientWidth) + 1) % products.length;
      track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [multiple, autoPlay, products.length]);

  // 상품이 없으면 영역 자체를 그리지 않는다. 호출자도 걸러 주지만, 컴포넌트 혼자
  // 봐도 빈 자리표시자를 남기지 않는 것이 드러나야 한다.
  if (products.length === 0) return null;

  return (
    <section
      aria-labelledby="product-banner-heading"
      className="flex flex-col gap-2"
    >
      {/*
        제목 줄. 배너만 있을 때는 섹션에 `aria-label`만 붙어 있어 눈으로는 이 묶음이
        무엇인지 알 수 없었다. 보이는 제목을 두면 `전체 보기`가 어디의 전체인지도
        같이 설명된다.

        좌우 여백을 주지 않는다. 슬라이드가 컨테이너 폭을 그대로 쓰므로, 제목과
        슬라이드의 왼쪽 끝이 어긋나면 배너가 살짝 밀려 보인다.
      */}
      <div className="flex items-center justify-between gap-2">
        <h2
          id="product-banner-heading"
          className="type-label-lg text-text-default md:type-heading-sm"
        >
          모집 중인 모임
        </h2>
        <Link
          href="/products"
          className="type-label-md inline-flex shrink-0 items-center gap-0.5 text-text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
        >
          전체 보기
          <Icon name="chevron-right" size={16} />
        </Link>
      </div>

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
        {products.map((product) => (
          <Slide key={product.id} product={product} />
        ))}
      </div>

      {multiple && (
        <div
          className="flex justify-center gap-[5px]"
          role="tablist"
          aria-label="상품 배너"
        >
          {products.map((product, dot) => (
            <button
              key={product.id}
              type="button"
              role="tab"
              aria-selected={dot === index}
              aria-label={`${dot + 1}번째 상품`}
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

function Slide({ product }: { product: ProductBannerItem }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="flex h-[120px] w-full shrink-0 snap-center flex-col justify-between rounded-2xl bg-background-brand p-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand md:h-[136px] md:p-4"
    >
      <span className="flex items-center justify-between gap-2">
        {/*
          시안의 태그 자리다. 상품마다 다른 문구를 넣을 수 없어(product에 분류
          컬럼이 없다) 고정 문구를 쓴다. `모집 중`은 이 배너가 세우는 상품의 조건
          그대로다 — 공개 상태이고 아직 지나지 않은 것만 여기 온다.
        */}
        <span className="type-label-md inline-flex items-center rounded-full bg-background-surface px-2 py-1 text-text-brand-strong">
          모집 중
        </span>
        {/* 정원은 없을 수 있다. 없으면 칩 자체를 빼고 왼쪽 칩만 남는다. */}
        {product.capacity !== null && (
          <span className="type-label-md inline-flex items-center rounded-full bg-background-surface px-2 py-1 text-text-brand">
            정원 {formatCapacity(product.capacity)}
          </span>
        )}
      </span>

      <span className="flex flex-col gap-1">
        <span className="type-heading-sm truncate text-text-on-brand md:type-heading-md">
          {product.name}
        </span>
        <span className="type-label-md truncate text-text-on-brand md:type-body-md">
          {subtitleOf(product)}
        </span>
      </span>
    </Link>
  );
}

/**
 * 제목 아래 한 줄 — `8/20 목 19:00 · 1인 40,000원`.
 *
 * 날짜도 가격도 없을 수 있다. 없는 조각은 빼고 잇는다. 둘 다 없으면 빈 줄이
 * 남지만, 그 자리에 "미정 · 미정"을 적는 것보다는 조용한 편이 낫다.
 */
function subtitleOf(product: ProductBannerItem): string {
  return [
    product.eventAt ? formatProductShort(product.eventAt) : null,
    product.price === null ? null : `1인 ${formatWon(product.price)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
