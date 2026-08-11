import Image from "next/image";
import Link from "next/link";

import { Icon } from "../foundation/Icon";

export interface RestaurantCardProps {
  href: string;
  name: string;
  /** One-line hook under the name. */
  summary: string;
  /** "오류동 · 12분 · 저장 38". */
  meta: string;
  image: string;
  /**
   * `sizes` for the thumbnail. Defaults to the main feed's grid; pass a narrower
   * value when the card sits in a different column count.
   */
  sizes?: string;
  className?: string;
}

/**
 * The feed card. One component, two shapes.
 *
 * design.pen draws it as a 82px row — 58px thumbnail, copy, chevron. That reads
 * well in a single phone column but not in a 4-up grid at 1280, so from md the
 * same card restacks into the design system's `Card` proportions: media on top
 * at a 4:3 crop, copy below, no chevron (the whole card is the target).
 *
 * Both shapes use the same tokens and the same radius as the design's row.
 */
export function RestaurantCard({
  href,
  name,
  summary,
  meta,
  image,
  sizes = "(min-width: 1280px) 292px, (min-width: 1024px) 30vw, (min-width: 768px) 45vw, 58px",
  className,
}: RestaurantCardProps) {
  return (
    <Link
      href={href}
      className={`group flex overflow-hidden rounded-2xl bg-background-surface p-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand md:flex-col md:p-0 ${className ?? ""}`}
    >
      {/* Phone: 58px square thumb. md+: full-bleed 4:3 media band. */}
      <div className="relative size-[58px] shrink-0 overflow-hidden rounded-[14px] md:aspect-[4/3] md:size-auto md:w-full md:rounded-none">
        <Image
          src={image}
          alt=""
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-200 md:group-hover:scale-105"
        />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 md:items-start md:gap-0 md:p-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1 pl-3 md:gap-1.5 md:pl-0">
          <h3 className="type-label-lg truncate text-text-default md:type-heading-sm">
            {name}
          </h3>
          <p className="type-label-md truncate text-text-muted md:type-body-md">
            {summary}
          </p>
          <p className="type-label-md truncate text-text-brand">{meta}</p>
        </div>

        {/* The row affordance; the grid card is clickable as a whole. */}
        <span className="shrink-0 text-text-subtle md:hidden" aria-hidden>
          <Icon name="chevron-right" size={16} />
        </span>
      </div>
    </Link>
  );
}
