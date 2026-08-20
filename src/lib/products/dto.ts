/**
 * 상품 DTO — BFF가 화면으로 내려보내는 유일한 모양.
 *
 * `product` 테이블의 Row가 아니다. 화면이 `image_path_main_md` 같은 컬럼명에
 * 묶이면 이름 하나 바꿀 때 화면이 깨진다. 경계는 여기다.
 *
 * 서버 전용이 아니다. 상품 화면이 타입과 상수를 쓴다.
 */

/**
 * 공개 상태. 이 값이 아닌 상품은 목록에도 상세에도 나오지 않는다.
 *
 * `product.status`는 자유 텍스트라 DB가 값을 강제하지 않는다. 화면마다 문자열을
 * 다시 비교하지 않도록 한 곳에 적어 둔다. `null`은 공개가 아니다 — 상태를 정하지
 * 않은 행이 자동으로 팔리면 안 된다.
 */
export const PRODUCT_PUBLIC_STATUS = "Public";

/**
 * `lg` 이미지로 갈아타는 지점(px). Tailwind의 `lg`와 같은 값이다.
 *
 * 이미지를 고르는 미디어 쿼리와 레이아웃의 분기점이 어긋나면, 태블릿에서
 * 데스크톱용 이미지를 받거나 그 반대가 된다. 그래서 숫자를 여기 한 번만 적는다.
 */
export const PRODUCT_IMAGE_LG_MIN_WIDTH = 1024;

/**
 * 한 자리에 들어가는 이미지 두 벌.
 *
 * 둘 다 완성된 URL이다. 앞단(호스트)은 환경변수, 뒷단(경로)은 DB 컬럼이고 그
 * 둘을 붙이는 일은 서버에서 끝난다. 화면은 버킷 이름도 호스트도 알 필요가 없다.
 */
export interface ProductImageDto {
  /** 모바일·태블릿(1024px 미만)에서 쓴다. */
  md: string;
  /** 데스크톱(1024px 이상)에서 쓴다. */
  lg: string;
}

export interface ProductDto {
  id: string;
  name: string;
  /** 상세 본문. 아직 안 쓴 상품은 null. */
  description: string | null;
  /** ISO 8601. 표기는 화면에서 한다. 날짜가 안 정해졌으면 null. */
  eventAt: string | null;
  address: string | null;
  capacity: number | null;
  /** 1인 가격(원). 아직 값이 없으면 null. */
  price: number | null;
  /** 목록 카드와 상세 히어로가 쓰는 배너. */
  mainImage: ProductImageDto | null;
  /** 상세 본문 아래에 붙는 큰 이미지. */
  detailImage: ProductImageDto | null;
  /** ISO 8601. */
  createdAt: string;
}

/** 목록 응답. 나중에 커서·총계가 붙어도 클라이언트가 안 깨지도록 감싼다. */
export interface ProductListDto {
  items: ProductDto[];
}

/**
 * 홈 배너에 넘기는 최소 정보.
 *
 * 배너는 클라이언트 컴포넌트다(자동 넘김과 스크롤 상태를 들고 있다). 상세 본문이나
 * 이미지 URL까지 통째로 내려보낼 이유가 없어 필요한 것만 추린다.
 */
export interface ProductBannerItem {
  id: string;
  name: string;
  eventAt: string | null;
  price: number | null;
  capacity: number | null;
}

export function toBannerItem(product: ProductDto): ProductBannerItem {
  return {
    id: product.id,
    name: product.name,
    eventAt: product.eventAt,
    price: product.price,
    capacity: product.capacity,
  };
}

/** 배너에 세울 최대 개수. 더 많으면 점이 늘어나 넘길 엄두가 안 난다. */
export const PRODUCT_BANNER_LIMIT = 5;
