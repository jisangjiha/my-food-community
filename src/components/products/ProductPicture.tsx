import {
  PRODUCT_IMAGE_LG_MIN_WIDTH,
  type ProductImageDto,
} from "../../lib/products/dto";

export interface ProductPictureProps {
  image: ProductImageDto;
  /** 장식용이면 빈 문자열. 옆에 같은 내용의 글이 있으면 그렇게 둔다. */
  alt: string;
  /** `<img>`에 그대로 붙는다. 크기는 바깥 컨테이너가 정한다. */
  className?: string;
  /** 첫 화면에 보이는 이미지면 true. 늦게 받으면 히어로 자리가 비어 보인다. */
  priority?: boolean;
}

/**
 * 상품 이미지 한 장 — 데스크톱은 `lg`, 모바일·태블릿은 `md`.
 *
 * `next/image`가 아니라 `<picture>`인 이유: 두 사이즈 중 하나를 고르는 주체가
 * 브라우저여야 한다. `<Image>` 두 벌을 `hidden lg:block`으로 감추는 방식은,
 * 감춘 쪽도 대부분의 브라우저가 내려받기 때문에 사이즈를 둘로 나눈 이유가
 * 사라진다. `<source media>`는 조건에 맞는 하나만 요청한다.
 *
 * 최적화를 잃지는 않는다. 버킷의 두 파일은 이미 크기별로 준비된 것이고, Unsplash
 * 쪽은 DB 경로에 `w`·`q`·`auto=format`이 실려 있어 호스트가 줄여서 내려 준다.
 *
 * `<picture>`는 `contents`로 둔다. 박스를 만들지 않으므로 `<img>`가 바깥 컨테이너의
 * 직접 자식처럼 놓이고, `size-full` 같은 유틸리티가 의도대로 걸린다.
 *
 * 지연 로딩은 걸지 않는다. 아직 안 받은 `<img>`는 높이가 0이라 문서가 자라지
 * 않는데, 그 상태로 문서 맨 아래에 있으면 화면에 걸려 있어도 끝내 로드되지 않는
 * 교착이 생긴다. 원본 비율을 지켜야 해서 `width`/`height`를 미리 박아 자리를
 * 잡아 둘 수도 없다. 상품 화면이 쓰는 이미지는 화면당 두 장뿐이라 즉시 받아도
 * 부담이 없다.
 */
export function ProductPicture({
  image,
  alt,
  className,
  priority = false,
}: ProductPictureProps) {
  return (
    <picture className="contents">
      <source
        media={`(min-width: ${PRODUCT_IMAGE_LG_MIN_WIDTH}px)`}
        srcSet={image.lg}
      />
      <img
        src={image.md}
        alt={alt}
        className={className}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
      />
    </picture>
  );
}
