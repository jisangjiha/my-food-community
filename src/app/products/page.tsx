import { AppShell } from "../../components/layout/AppShell";
import { PageContainer } from "../../components/layout/PageContainer";
import { ProductCard } from "../../components/products/ProductCard";
import { Empty } from "../../components/ui/Empty";
import { listProducts } from "../../lib/products/service";

/**
 * 상품 목록.
 *
 * 서버 컴포넌트라 서비스 함수를 직접 부른다. 자기 앱의 `/api/products`로 다시
 * HTTP 요청을 보내면 왕복 하나가 통째로 낭비된다 — 그 라우트는 외부 호출자용이다.
 *
 * 그리드는 CLAUDE.md의 규칙 그대로 1열 → md 2열 → lg 3열 → xl 4열이고, 폭 상한은
 * `PageContainer`가 쥔다.
 */
export default async function ProductListPage() {
  const products = await listProducts();

  return (
    <AppShell>
      <PageContainer
        as="main"
        className="flex flex-col gap-4 py-4 md:gap-24 md:py-32"
      >
        <header className="flex flex-col gap-px p-1 md:gap-1.5 md:p-0">
          <span className="type-label-md text-text-brand">숨은맛집 클래스</span>
          <h1 className="type-heading-lg text-text-default md:type-display-sm">
            함께하는 자리
          </h1>
          <p className="type-label-md text-text-muted md:type-body-lg">
            이웃과 같이 배우고 먹는 모임을 둘러보세요.
          </p>
        </header>

        <section aria-label="상품 목록">
          {products.length === 0 ? (
            <Empty
              icon="search"
              title="아직 열린 자리가 없어요"
              description="새로운 모임이 올라오면 여기에서 볼 수 있어요."
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <li key={product.id} className="flex">
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageContainer>
    </AppShell>
  );
}
