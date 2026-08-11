/**
 * Mock content, transcribed from the hi-fi screens in design.pen.
 *
 * The handoff is UI-only — there is no backend yet — so every page reads from
 * here. Copy, place names and numbers are the design file's, verbatim, so a
 * screen in Pencil and a screen in the browser say the same thing.
 */

export interface Restaurant {
  id: string;
  /** Place name, e.g. "Mango Table". */
  name: string;
  /** One-line hook under the name in the feed. */
  summary: string;
  /** 동 name shown first in the meta line. */
  area: string;
  /** Drive time in minutes, from the "12분" meta. */
  minutes: number;
  /** Save count, from the "저장 38" meta. */
  saves: number;
  image: string;
  /** Detail page only — the fields below back `/restaurants/[id]`. */
  detail?: RestaurantDetail;
}

export interface RestaurantDetail {
  /** Overlay title on the hero, two lines in the design. */
  heroTitle: string;
  /** Uploader handle shown in the tag above the hero title. */
  source: string;
  heroImage: string;
  /** "지금 방문 가능" — opening status. */
  status: string;
  /** "항동 · 주차 가능" — area plus amenities. */
  areaNote: string;
  /** Full title in the card body. */
  title: string;
  rating: number;
  reviewCount: number;
  /** "2인 38,000원". */
  cost: string;
  address: string;
  review: {
    body: string;
    author: string;
    date: string;
  };
}

export const restaurants: Restaurant[] = [
  {
    id: "mango-table",
    name: "Mango Table",
    summary: "작은 마당이 있는 가정식",
    area: "오류동",
    minutes: 12,
    saves: 38,
    image: "/images/mango-table.png",
    detail: {
      heroTitle: "골목에서 찾은\nMango Table",
      source: "guro_hidden_03",
      heroImage: "/images/detail-hero.png",
      status: "지금 방문 가능",
      areaNote: "항동 · 주차 가능",
      title: "조용한 골목 파스타 맛집",
      rating: 4.8,
      reviewCount: 32,
      cost: "2인 38,000원",
      address: "서울 구로구 항동로 21-6",
      review: {
        body: "유명한 곳은 아니지만 주말 점심에 드라이브 겸 들르기 좋아요. 매장이 작아서 아이와 가면 이른 시간 방문을 추천해요.",
        author: "경경경님",
        date: "25.12.16",
      },
    },
  },
  {
    id: "may-restaurant",
    name: "오월식당",
    summary: "예약해야 먹는 들깨칼국수",
    area: "개봉동",
    minutes: 9,
    saves: 38,
    image: "/images/may-restaurant.png",
  },
  {
    id: "cafe-night",
    name: "밤의 카페",
    summary: "늦게까지 조용한 디저트",
    area: "구로동",
    minutes: 15,
    saves: 38,
    image: "/images/cafe-night.png",
  },
  {
    id: "weekend-garden",
    name: "주말정원",
    summary: "아이와 가기 좋은 작은 마당 식당",
    area: "천왕동",
    minutes: 16,
    saves: 18,
    image: "/images/weekend-garden.png",
  },
];

export function getRestaurant(id: string): Restaurant | undefined {
  return restaurants.find((restaurant) => restaurant.id === id);
}

/** The meta line under a card: "오류동 · 12분 · 저장 38". */
export function metaLine(restaurant: Restaurant): string {
  return `${restaurant.area} · ${restaurant.minutes}분 · 저장 ${restaurant.saves}`;
}

/** The main page's featured block. */
export const featured = {
  badge: "이번 주 이웃 추천",
  title: "차로 18분, 조용한 골목 파스타",
  meta: "항동 · 주차 가능 · 4.8",
  image: "/images/featured-pasta.png",
  href: "/restaurants/mango-table",
  chips: ["데이트", "가족", "주차"],
};

/** Category chips above the feed. */
export const categories = ["전체", "한식", "카페", "아이동반"];

/** The signed-in user shown on 마이 페이지. */
export const profile = {
  name: "홍지상",
  handle: "guro_hidden_03 · 구로동",
  stats: [
    { value: "12", label: "등록" },
    { value: "38", label: "저장" },
    { value: "5", label: "후기" },
  ],
};

/** 마이 페이지 list — the design shows each post with its publish date. */
export const myPosts = [
  { id: "may-restaurant", date: "25.12.10", saves: 38 },
  { id: "cafe-night", date: "25.11.28", saves: 21 },
  { id: "weekend-garden", date: "25.11.02", saves: 18 },
  { id: "mango-table", date: "25.10.19", saves: 12 },
];
