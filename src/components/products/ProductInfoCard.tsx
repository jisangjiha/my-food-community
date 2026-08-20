import type { ProductDto } from "../../lib/products/dto";
import {
  formatCapacity,
  formatProductDateTime,
  formatWon,
} from "../../lib/products/format";
import { DetailRow } from "../ui/DetailRow";

/**
 * 일시·장소·정원·가격 — 모임 상세의 `Info Card`와 같은 카드다.
 *
 * `product`의 컬럼은 모두 nullable이라 값이 없는 줄은 아예 그리지 않는다. 빈 줄을
 * 남기면 화면이 "정보가 있는데 못 불러왔다"고 말하게 된다. 네 줄이 전부 비면
 * 카드 자체를 뺀다.
 */
export function ProductInfoCard({ product }: { product: ProductDto }) {
  const rows = [
    product.eventAt && (
      <DetailRow key="event" label="일시">
        {formatProductDateTime(product.eventAt)}
      </DetailRow>
    ),
    product.address && (
      <DetailRow key="address" label="장소">
        {product.address}
      </DetailRow>
    ),
    product.capacity !== null && (
      <DetailRow key="capacity" label="정원" tone="text-text-brand">
        {formatCapacity(product.capacity)}
      </DetailRow>
    ),
    product.price !== null && (
      <DetailRow key="price" label="1인 가격">
        {formatWon(product.price)}
      </DetailRow>
    ),
  ].filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <section
      aria-label="상품 정보"
      className="flex flex-col gap-3 rounded-2xl border border-border-default bg-background-surface p-4"
    >
      {rows}
    </section>
  );
}
