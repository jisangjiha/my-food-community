import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { ButtonLink } from "../../components/ui/ButtonLink";
import { DetailRow } from "../../components/ui/DetailRow";
import { MapCanvas } from "../../components/ui/MapCanvas";
import { MapPreview } from "../../components/ui/MapPreview";
import { NaverMap } from "../../components/ui/NaverMap";
import { PlaceResultItem } from "../../components/ui/PlaceResultItem";
import { RestaurantCard } from "../../components/ui/RestaurantCard";
import { StatTile } from "../../components/ui/StatTile";
import { Stepper } from "../../components/ui/Stepper";
import { profile, restaurants, metaLine } from "../../lib/restaurants";
import { Gallery, Specimen } from "../lib/Matrix";

const meta = {
  title: "UI/Handoff",
  parameters: {
    docs: {
      description: {
        component:
          "하이파이 핸드오프에서 추가된 컴포넌트입니다. 기존 디자인 시스템 컴포넌트로 표현할 수 없는 화면 전용 패턴만 여기에 있습니다. 모두 `src/tokens/*` 토큰과 `type-*` 유틸리티만 사용합니다.",
      },
    },
    controls: { disable: true },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const sample = restaurants[1];

/**
 * design.pen `04a Place Search - Results`가 그린 5건. 실제 검색은 네이버
 * 지역검색 API가 하지만, Storybook에는 서버가 없어 시안 값을 그대로 둡니다.
 */
const PLACE_RESULTS = [
  { name: "오월식당", address: "서울 구로구 디지털로 300" },
  { name: "오월식당 신도림점", address: "서울 구로구 경인로 662" },
  { name: "오월 브런치", address: "서울 구로구 디지털로26길 38" },
  { name: "오월정 한식당", address: "서울 영등포구 도림로 45" },
  { name: "카페 오월", address: "서울 구로구 구로중앙로 152" },
];

/**
 * One component, two shapes. The phone row is design.pen's `오월식당 Card`;
 * from md it restacks into a grid card so it reads at 1280.
 */
export const RestaurantCards: Story = {
  render: () => (
    <Gallery>
      <Specimen
        label="모바일 (row)"
        description="360px 기준 — design.pen Restaurant Feed 카드"
      >
        <div className="w-[328px] bg-background-canvas p-2">
          <RestaurantCard
            href="#"
            name={sample.name}
            summary={sample.summary}
            meta={metaLine(sample)}
            image={sample.image}
            sizes="58px"
          />
        </div>
      </Specimen>

      <Specimen
        label="md+ (grid card)"
        description="768px 이상에서 미디어가 위로 올라가고 chevron이 사라집니다"
      >
        <div className="w-[292px] bg-background-canvas p-2">
          {/* The story frame is narrow, so the md shape is forced for display. */}
          <div className="[&_a]:!flex-col [&_a]:!p-0">
            <RestaurantCard
              href="#"
              name={sample.name}
              summary={sample.summary}
              meta={metaLine(sample)}
              image={sample.image}
              sizes="292px"
            />
          </div>
        </div>
      </Specimen>

      <Specimen
        label="반응형 그리드"
        description="1열 → md 2열 → lg 3열 → xl 4열, 최대 1280"
      >
        <div className="grid grid-cols-1 gap-3 bg-background-canvas p-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {restaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              href="#"
              name={restaurant.name}
              summary={restaurant.summary}
              meta={metaLine(restaurant)}
              image={restaurant.image}
            />
          ))}
        </div>
      </Specimen>
    </Gallery>
  ),
};

export const StatTiles: Story = {
  render: () => (
    <Gallery>
      <Specimen label="마이 페이지 카운트 행">
        <div className="flex w-[328px] gap-2 bg-background-canvas p-2">
          {profile.stats.map((stat) => (
            <StatTile key={stat.label} value={stat.value} label={stat.label} />
          ))}
        </div>
      </Specimen>
    </Gallery>
  ),
};

/**
 * 지도 면입니다. 시안은 네이버 지도 타일을 캡처해 넣었지만 아직 지도 API가 없어
 * 도식으로 그립니다. 크기·라운드·핀은 시안 값 그대로이므로, API가 붙으면 이
 * 컴포넌트 안쪽만 타일로 바뀝니다.
 */
export const MapCanvases: Story = {
  render: () => (
    <Gallery>
      <Specimen
        label="sm (150) — 상세 미니맵"
        description="design.pen 02b Detail Page - Map"
      >
        <div className="w-[328px]">
          <MapCanvas label="Mango Table" />
        </div>
      </Specimen>
      <Specimen
        label="lg (440) — 장소 등록"
        description="design.pen 04 Place Register - Location"
      >
        <div className="w-[328px]">
          <MapCanvas label="오월식당" size="lg" />
        </div>
      </Specimen>
    </Gallery>
  ),
};

/**
 * 장소 등록 화면의 실제 네이버 지도입니다. Storybook에는 서버가 없어 API 키를
 * 내려줄 수 없으므로 여기서는 폴백 상태만 보입니다. 살아 있는 지도는 앱의
 * `/register/place`에서 확인하세요.
 *
 * 핀은 마커가 아니라 화면 중앙에 고정된 오버레이입니다. 지도가 그 밑에서
 * 움직이고, `pointer-events-none` 덕분에 핀 위에서 시작한 드래그도 지도로
 * 전달됩니다.
 *
 * `variant="static"`은 상세 화면용입니다. 중앙 고정 핀 대신 좌표에 마커를 박고
 * 드래그·줌을 끕니다. 살아 있는 모습은 앱의 `/restaurants/{id}`에서 확인하세요.
 */
export const NaverMapFallback: Story = {
  render: () => (
    <Gallery>
      <Specimen
        label="키 없음 — 도식 폴백"
        description="NAVER_MAP_CLIENT_ID가 없거나 스크립트 로드·인증이 실패하면 MapCanvas 도식으로 되돌아갑니다."
      >
        <div className="w-[328px]">
          <NaverMap label="오월식당" clientId={null} />
        </div>
      </Specimen>
      <Specimen
        label="static — 상세 미니지도 (폴백)"
        description="variant=static은 좌표에 마커를 박고 조작을 끕니다. 키가 없어 여기서는 sm 규격의 도식으로 보입니다."
      >
        <div className="w-[328px]">
          <NaverMap
            label="예빈당 성수본점"
            clientId={null}
            variant="static"
            size="sm"
          />
        </div>
      </Specimen>
      <Specimen
        label="marker — 고른 장소 확인 (폴백)"
        description="variant=marker는 좌표에 마커를 못 박고 지도는 자유롭게 움직입니다. 중심을 보고하지 않아 아무리 끌어도 선택이 바뀌지 않습니다."
      >
        <div className="w-[328px]">
          <NaverMap
            label="예빈당 성수본점"
            clientId={null}
            variant="marker"
            size="lg"
          />
        </div>
      </Specimen>
    </Gallery>
  ),
};

/**
 * 지도 아래 주소 카드입니다. 예전 시안에서는 이 카드가 도식 지도까지 품고
 * 있었지만, 새 시안은 지도를 `MapCanvas`로 빼내고 주소 한 줄만 남겼습니다.
 */
export const MapPreviews: Story = {
  render: () => (
    <Gallery>
      <Specimen
        label="filled — 상세"
        description="design.pen 02b Detail Page - Map의 Address Map Preview"
      >
        <div className="w-[328px] flex flex-col gap-2">
          <MapCanvas label="Mango Table" />
          <MapPreview address="서울 구로구 항동로 21-6" />
        </div>
      </Specimen>
      <Specimen
        label="empty — 주소 없는 글"
        description="place.address가 아직 '등록 대기중'일 때. 지도는 그리지 않습니다."
      >
        <div className="w-[328px]">
          <MapPreview address="등록 대기중" state="empty" />
        </div>
      </Specimen>
    </Gallery>
  ),
};

/**
 * 장소 검색 결과 한 줄입니다. 시안에는 눌린 상태가 없지만 실제로는 누르는 줄이라
 * hover/focus를 붙였습니다.
 */
export const PlaceResultItems: Story = {
  render: () => (
    <Gallery>
      <Specimen
        label="검색 결과 목록"
        description='design.pen 04a Place Search - Results — "오월" 5건'
      >
        <div className="flex w-[328px] flex-col bg-background-canvas p-2">
          <p className="type-label-md text-text-muted">
            검색 결과 {PLACE_RESULTS.length}
          </p>
          {PLACE_RESULTS.map((place) => (
            <PlaceResultItem
              key={place.name}
              href="#"
              name={place.name}
              address={place.address}
            />
          ))}
        </div>
      </Specimen>
    </Gallery>
  ),
};

/**
 * `Button`과 같은 토큰·크기를 쓰지만 `<a>`로 렌더링합니다. 두 컴포넌트 모두
 * `buttonAppearance()`에서 클래스와 박스를 가져오므로 어긋날 수 없습니다.
 */
export const ButtonLinks: Story = {
  render: () => (
    <Gallery>
      <Specimen label="variant × size">
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="#" leadingIcon="plus">
            등록
          </ButtonLink>
          <ButtonLink href="#" variant="secondary" leadingIcon="edit">
            수정
          </ButtonLink>
          <ButtonLink href="#" variant="destructive" leadingIcon="delete">
            삭제
          </ButtonLink>
          <ButtonLink href="#" size="sm">
            sm
          </ButtonLink>
          <ButtonLink href="#" size="lg">
            lg
          </ButtonLink>
        </div>
      </Specimen>
    </Gallery>
  ),
};

/**
 * 결제 시트의 인원 선택입니다. 상한은 `min(남은 자리, 1인당 최대 매수)`이고,
 * 상한에 닿으면 `+`가 비활성됩니다. 왜 그 상한인지는 시트가 문구로 알려 줍니다.
 */
export const Steppers: Story = {
  render: () => <StepperDemo />,
};

function StepperDemo() {
  const [count, setCount] = useState(2);

  return (
    <Gallery>
      <Specimen label="상한 4" description="남은 자리 8, 1인당 4매">
        <Stepper
          value={count}
          max={4}
          onChange={setCount}
          decreaseLabel="인원 줄이기"
          increaseLabel="인원 늘리기"
        />
      </Specimen>
      <Specimen label="상한에 닿음" description="+ 비활성">
        <Stepper
          value={4}
          max={4}
          onChange={() => {}}
          decreaseLabel="인원 줄이기"
          increaseLabel="인원 늘리기"
        />
      </Specimen>
      <Specimen label="최소" description="− 비활성">
        <Stepper
          value={1}
          max={4}
          onChange={() => {}}
          decreaseLabel="인원 줄이기"
          increaseLabel="인원 늘리기"
        />
      </Specimen>
    </Gallery>
  );
}

/**
 * 라벨-값 한 줄입니다. 모임 정보 카드 · 결제 완료 카드 · 취소 모달이 같은 줄을
 * 씁니다. 강조가 필요한 값은 `tone`으로 색만 바꿉니다.
 */
export const DetailRows: Story = {
  render: () => (
    <Gallery>
      <Specimen label="기본 / 강조" description="카드 안 296px 기준">
        <div className="flex w-[296px] flex-col gap-3 rounded-2xl border border-border-default bg-background-surface p-4">
          <DetailRow label="결제 금액">50,000원</DetailRow>
          <DetailRow label="참여 인원" tone="text-text-brand">
            12명 / 최대 20명 · 남은 8석
          </DetailRow>
          <DetailRow label="적용 규정">모임 3~7일 전 (50%)</DetailRow>
        </div>
      </Specimen>
    </Gallery>
  ),
};
