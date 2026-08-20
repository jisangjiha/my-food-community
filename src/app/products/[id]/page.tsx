import { notFound } from "next/navigation";

import { Icon } from "../../../components/foundation/Icon";
import { AppShell } from "../../../components/layout/AppShell";
import { FlowTopBar } from "../../../components/layout/FlowTopBar";
import { PageContainer } from "../../../components/layout/PageContainer";
import { ProductInfoCard } from "../../../components/products/ProductInfoCard";
import { ProductPayBar } from "../../../components/products/ProductPayBar";
import { ProductPicture } from "../../../components/products/ProductPicture";
import { NotFoundError } from "../../../lib/api/http";
import { getCurrentUser } from "../../../lib/auth/session";
import { buildCheckout } from "../../../lib/payments/service";
import type { ProductDto } from "../../../lib/products/dto";
import { getProduct } from "../../../lib/products/service";

/**
 * 상품 상세.
 *
 * 읽는 화면이라 본문 폭은 800에서 멈춘다(CLAUDE.md의 폭 규칙).
 *
 * 하단에 결제 바가 붙는다. 결제창에 넘길 값은 전부 서버에서 만든다 —
 * 포트원 키는 환경변수에서, 금액과 주문명은 DB에서 온다. 브라우저는 결제 건
 * ID만 만든다.
 */
export default async function ProductDetailPage(
  props: PageProps<"/products/[id]">,
) {
  const { id } = await props.params;
  const product = await loadProduct(id);

  // 비로그인도 상세는 본다. 결제 버튼만 로그인으로 가는 링크가 된다.
  const user = await getCurrentUser();
  const checkout = user ? buildCheckout(product, user) : null;

  return (
    <AppShell tabBar={false}>
      <FlowTopBar backHref="/products" title="상품 상세" />

      <PageContainer
        as="main"
        width="article"
        className="flex flex-col gap-4 py-4 md:py-32"
      >
        {/*
          히어로 — 배너. 데스크톱은 lg, 모바일·태블릿은 md를 받는다.

          맛집·모임 상세와 달리 고정 비율로 자르지 않는다. 두 배너는 각자의
          화면폭에 맞춰 그려진 것이라 비율부터 다르고(lg 1696×624, md 1456×720),
          한쪽 비율에 맞춰 `object-cover`로 덮으면 반대쪽에서 문구와 그림이 잘린다.
          사진이 아니라 글자가 박힌 디자인이므로 잘리면 그대로 정보가 사라진다.
        */}
        {product.mainImage ? (
          <ProductPicture
            image={product.mainImage}
            alt=""
            className="w-full rounded-2xl"
            priority
          />
        ) : (
          <div
            className="flex aspect-[36/23] w-full items-center justify-center rounded-2xl bg-background-brand-subtle text-text-subtle md:aspect-[21/9]"
            aria-hidden
          >
            <Icon name="image" size={32} />
          </div>
        )}

        <header className="flex flex-col gap-1.5">
          <h1 className="type-heading-lg text-text-default md:type-display-sm">
            {product.name}
          </h1>
        </header>

        <ProductInfoCard product={product} />

        {product.description && (
          <section
            aria-labelledby="product-desc"
            className="flex flex-col gap-2"
          >
            <h2 id="product-desc" className="type-heading-sm text-text-default">
              상품 소개
            </h2>
            <p className="type-body-md whitespace-pre-line text-text-muted md:type-body-lg">
              {product.description}
            </p>
          </section>
        )}

        {/*
          상세 이미지. 자를 이유가 없으므로 원본 비율 그대로 둔다 — 히어로처럼
          고정 비율에 맞추면 세로로 긴 상세 컷이 잘려 나간다.
        */}
        {product.detailImage && (
          <section aria-labelledby="product-detail" className="flex flex-col gap-2">
            <h2
              id="product-detail"
              className="type-heading-sm text-text-default"
            >
              상세 정보
            </h2>
            <ProductPicture
              image={product.detailImage}
              alt={`${product.name} 상세 이미지`}
              className="w-full rounded-2xl"
            />
          </section>
        )}
      </PageContainer>

      <ProductPayBar
        checkout={checkout}
        price={product.price}
        loginHref={user ? null : `/login?next=/products/${product.id}`}
      />
    </AppShell>
  );
}

/** 없는 상품과 잘못된 id는 똑같이 404다. 던지면 500이 되고 "고장난 페이지"가 된다. */
async function loadProduct(id: string): Promise<ProductDto> {
  try {
    return await getProduct(id);
  } catch (reason) {
    if (reason instanceof NotFoundError) {
      notFound();
    }
    throw reason;
  }
}
