import Image from "next/image";
import Link from "next/link";

import type { ProductDto } from "../../lib/products/dto";
import { formatProductShort, formatWon } from "../../lib/products/format";
import { Icon } from "../foundation/Icon";

/**
 * 목록 카드 한 장.
 *
 * `RestaurantCard`를 쓰지 않는다. 그 카드의 미디어 칸은 폰에서 58px 정사각,
 * md부터 4:3인데 상품 배너는 2:1 언저리이고 글자가 박힌 디자인이다. 그 비율에
 * 넣으면 가운데 여백만 남고 문구가 통째로 잘려 나간다. 사진은 잘려도 사진이지만
 * 배너는 잘리면 정보가 사라진다.
 *
 * 미디어 칸은 모든 폭에서 2:1이다. 배너 원본이 그 언저리라 잘리는 부분이 거의
 * 없고, 그리드 한 줄에 선 카드들의 높이도 어긋나지 않는다.
 *
 * 여백·모서리·타이포는 `Card`·`RestaurantCard`와 같은 값을 쓴다. 같은 그리드에
 * 두 카드가 섞여도 따로 놀지 않아야 한다.
 */
export function ProductCard({ product }: { product: ProductDto }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-border-default bg-background-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
    >
      <div className="relative aspect-[2/1] w-full shrink-0 overflow-hidden bg-background-brand-subtle">
        {product.mainImage ? (
          /*
            카드에서는 `md` 한 장만 쓰고 `next/image`에 맡긴다. 상세 히어로처럼
            폭에 따라 두 배너를 갈아 끼우지 않는 이유가 둘 있다. 카드 크기에서는
            두 배너가 눈에 띄게 다르지 않고, 원본 PNG가 2MB짜리라 그리드 한 화면에
            그대로 깔면 수 MB가 된다. `next/image`가 카드 폭에 맞춰 줄여서 내려 준다.
            `md`를 고르는 것도 이유가 있다 — 2.02:1이라 2:1 칸에 거의 손실 없이 들어간다.
          */
          <Image
            src={product.mainImage.md}
            alt=""
            fill
            sizes="(min-width: 1280px) 292px, (min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
            className="object-cover transition-transform duration-200 md:group-hover:scale-105"
          />
        ) : (
          <span
            className="flex size-full items-center justify-center text-text-subtle"
            aria-hidden
          >
            <Icon name="image" size={32} />
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-3.5">
        <h3 className="type-heading-sm truncate text-text-default">
          {product.name}
        </h3>
        {product.address && (
          <p className="type-body-md truncate text-text-muted">
            {product.address}
          </p>
        )}
        <p className="type-label-md truncate text-text-brand">
          {metaOf(product)}
        </p>
      </div>
    </Link>
  );
}

/**
 * 강조 줄 — `30,000원 · 8/29 토 12:10`.
 *
 * 값이 없는 조각은 빼고 잇는다. `· `만 남은 줄을 만들지 않기 위해서다.
 */
function metaOf(product: ProductDto): string {
  return [
    product.price === null ? "가격 미정" : formatWon(product.price),
    product.eventAt ? formatProductShort(product.eventAt) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
