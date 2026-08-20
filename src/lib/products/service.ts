import "server-only";

import { NotFoundError } from "@/lib/api/http";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_IMAGE_BUCKET, publicStorageUrl } from "@/lib/supabase/storage";

import {
  PRODUCT_BANNER_LIMIT,
  PRODUCT_PUBLIC_STATUS,
  type ProductDto,
  type ProductImageDto,
} from "./dto";
import { unsplashImageBaseUrl } from "./env";

/**
 * 상품 데이터 접근 계층.
 *
 * Supabase를 아는 코드는 여기까지다. Route Handler와 서버 컴포넌트는 이 함수들만
 * 부르고 DTO만 받는다.
 *
 * 쓰기 함수는 없다. 상품 행은 운영자가 직접 넣고 어드민 화면은 이번 범위 밖이라
 * 앱에는 읽는 경로만 있다. DB에도 select 정책만 있어서 쓰기는 계속 막혀 있다.
 */

const PRODUCT_SELECT =
  "id, name, description, event_at, address, capacity, price, image_path_main_md, image_path_main_lg, image_path_detail_md, image_path_detail_lg, status, created_at";

/**
 * 응답 한 줄의 모양. 파싱에만 쓰고 밖으로 내보내지 않는다.
 *
 * `capacity`·`price`는 Postgres `numeric`이다. PostgREST가 숫자로 보내지만 정밀도
 * 보존을 위해 문자열로 오는 설정도 있어서, 두 경우를 모두 받아 두고 DTO로 옮길 때
 * 숫자로 못 박는다. 화면에서 `toLocaleString`을 부르는데 문자열이 오면 조용히
 * 이상한 값이 찍힌다.
 */
interface ProductRow {
  id: number;
  name: string | null;
  description: string | null;
  event_at: string | null;
  address: string | null;
  capacity: number | string | null;
  price: number | string | null;
  image_path_main_md: string | null;
  image_path_main_lg: string | null;
  image_path_detail_md: string | null;
  image_path_detail_lg: string | null;
  status: string | null;
  created_at: string;
}

/**
 * 목록에 세울 상품.
 *
 * 최신 등록순이다. `event_at` 순으로 세우면 이미 지난 날짜가 맨 위에 올라온다.
 * 지난 상품을 감추는 규칙은 아직 정해진 것이 없어서 여기서 만들어 내지 않는다.
 */
export async function listProducts(): Promise<ProductDto[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product")
    .select(PRODUCT_SELECT)
    .eq("status", PRODUCT_PUBLIC_STATUS)
    .order("created_at", { ascending: false });

  if (error) {
    // 원본 에러는 로그에만. 호출자는 일반 예외를 받는다.
    console.error("[products] 목록 조회 실패", error);
    throw new Error("상품 목록을 불러오지 못했습니다.");
  }

  return ((data ?? []) as unknown as ProductRow[])
    .map(toDto)
    .filter((product): product is ProductDto => product !== null);
}

/**
 * 홈 배너에 세울 상품.
 *
 * 목록과 규칙이 다르다. 목록은 등록된 것을 다 보여 주지만, 배너는 "지금 갈 수 있는
 * 자리"를 미는 자리라 이미 지난 날짜를 올려 두면 그 자체로 거짓말이 된다. 그래서
 * 지나지 않은 것만, 임박한 순으로 세운다.
 *
 * 날짜가 없는 상품(`event_at is null`)은 남긴다. 날짜를 아직 안 정했을 뿐 지난
 * 상품은 아니다. 다만 임박순으로는 세울 수 없으므로 뒤로 보낸다.
 */
export async function listBannerProducts(): Promise<ProductDto[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product")
    .select(PRODUCT_SELECT)
    .eq("status", PRODUCT_PUBLIC_STATUS)
    .or(`event_at.is.null,event_at.gte.${new Date().toISOString()}`)
    .order("event_at", { ascending: true, nullsFirst: false })
    .limit(PRODUCT_BANNER_LIMIT);

  if (error) {
    console.error("[products] 배너 조회 실패", error);
    // 배너는 없어도 홈이 성립한다. 여기서 던지면 배너 하나 때문에 홈 전체가
    // 500이 된다 — 그건 맞바꿀 만한 거래가 아니다.
    return [];
  }

  return ((data ?? []) as unknown as ProductRow[])
    .map(toDto)
    .filter((product): product is ProductDto => product !== null);
}

export async function getProduct(id: string): Promise<ProductDto> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product")
    .select(PRODUCT_SELECT)
    .eq("id", parseProductId(id))
    // 공개가 아닌 상품은 주소를 직접 쳐도 안 보인다. 목록에서만 감추면 링크 한 번
    // 새어 나갔을 때 그대로 열린다.
    .eq("status", PRODUCT_PUBLIC_STATUS)
    .maybeSingle();

  if (error) {
    console.error("[products] 상세 조회 실패", error);
    throw new Error("상품을 불러오지 못했습니다.");
  }

  const product = data ? toDto(data as unknown as ProductRow) : null;
  if (!product) {
    throw new NotFoundError("상품을 찾을 수 없습니다.");
  }

  return product;
}

export interface ProductSnapshot {
  product: ProductDto;
  /**
   * 결제 스냅샷에 그대로 실을 원본 행.
   *
   * DTO가 아니라 행이다. 스냅샷의 존재 이유가 "그때 DB에 무엇이 있었는가"를
   * 남기는 것이라, DTO로 깎으면서 버린 컬럼이 바로 나중에 확인하고 싶어지는
   * 컬럼이 된다. 그래서 `select *`로 받아 손대지 않고 넘긴다.
   */
  row: Record<string, unknown>;
}

/**
 * 결제 확정용 상품 조회.
 *
 * `getProduct`와 두 가지가 다르다.
 *
 * 첫째, 공개 상태를 보지 않는다. 결제는 이미 일어났다. 결제와 완료 화면 사이에
 * 운영자가 상품을 내렸다고 해서 기록을 거부하면, 돈은 받았는데 주문은 없는
 * 상태가 된다. 노출 규칙은 파는 화면의 규칙이지 이미 팔린 건의 규칙이 아니다.
 *
 * 둘째, 원본 행을 함께 돌려준다. 스냅샷이 그것을 요구한다.
 */
export async function getProductSnapshot(id: string): Promise<ProductSnapshot> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product")
    .select("*")
    .eq("id", parseProductId(id))
    .maybeSingle();

  if (error) {
    console.error("[products] 스냅샷 조회 실패", error);
    throw new Error("상품을 불러오지 못했습니다.");
  }

  const product = data ? toDto(data as unknown as ProductRow) : null;
  if (!data || !product) {
    throw new NotFoundError("상품을 찾을 수 없습니다.");
  }

  return { product, row: data as unknown as Record<string, unknown> };
}

/**
 * `product.id`는 bigint다. 라우트 파라미터에는 무엇이든 올 수 있으므로 여기서
 * 거른다. 숫자가 아닌 값을 그대로 넘기면 Postgres가 던져 500이 되는데, 없는
 * 상품과 잘못된 id는 사용자에게 똑같이 404다.
 */
function parseProductId(id: string): number {
  const parsed = Number(id);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new NotFoundError("상품을 찾을 수 없습니다.");
  }
  return parsed;
}

function toDto(row: ProductRow): ProductDto | null {
  // 이름 없는 상품은 목록에서 보여 줄 것이 없다. 조용히 빼지 않고 로그를 남긴다 —
  // 행을 직접 넣는 동안 왜 안 보이는지 알 수 있어야 한다.
  if (!row.name) {
    console.warn(`[products] name이 비어 있어 건너뜁니다. id=${row.id}`);
    return null;
  }

  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    eventAt: row.event_at,
    address: row.address,
    capacity: toNumber(row.capacity),
    price: toNumber(row.price),
    mainImage: toImagePair(
      row.image_path_main_md,
      row.image_path_main_lg,
      productStorageUrl,
    ),
    detailImage: toImagePair(
      row.image_path_detail_md,
      row.image_path_detail_lg,
      unsplashUrl,
    ),
    createdAt: row.created_at,
  };
}

function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 이미지 한 자리.
 *
 * 한쪽 사이즈만 있으면 있는 쪽으로 둘 다 채운다. 크기가 덜 맞는 이미지와 이미지가
 * 아예 없는 것 중에서는 전자가 낫다.
 */
function toImagePair(
  mdPath: string | null,
  lgPath: string | null,
  toUrl: (path: string) => string,
): ProductImageDto | null {
  const md = mdPath ? toUrl(mdPath) : null;
  const lg = lgPath ? toUrl(lgPath) : null;

  const resolvedMd = md ?? lg;
  const resolvedLg = lg ?? md;
  if (!resolvedMd || !resolvedLg) return null;

  return { md: resolvedMd, lg: resolvedLg };
}

/** 배너는 우리 버킷에 있다. 앞단은 `SUPABASE_STORAGE_URL`이 붙인다. */
function productStorageUrl(path: string): string {
  return publicStorageUrl(PRODUCT_IMAGE_BUCKET, path);
}

/**
 * 상세 이미지는 아직 버킷에 없어 Unsplash에서 온다.
 *
 * DB 값에 `?w=1600&q=80` 같은 쿼리스트링이 그대로 들어 있으므로
 * `publicStorageUrl`처럼 세그먼트를 인코딩하면 안 된다. `?`와 `&`가 `%3F`·`%26`이
 * 되어 이미지가 통째로 404가 된다.
 */
function unsplashUrl(path: string): string {
  const base = unsplashImageBaseUrl().replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}
