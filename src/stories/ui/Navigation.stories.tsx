import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  BottomNavigation,
  TabNavigation,
  TopNavigation,
} from "../../components/ui/Navigation";
import { Gallery, Specimen } from "../lib/Matrix";

const meta = {
  title: "UI/Navigation",
  parameters: {
    docs: {
      description: {
        component:
          "11-ds-ui-component-navigation.txt의 3개 컴포넌트입니다. 셋 다 타입·상태 구분이 없어 매트릭스 대신 구성 변형으로 보여줍니다.",
      },
    },
    controls: { disable: true },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const NAV_ITEMS = [
  { name: "home" as const, label: "홈" },
  { name: "search" as const, label: "맛지도" },
  { name: "edit" as const, label: "등록" },
  { name: "user" as const, label: "MY" },
];

/** 56px, optional icon button on each side, heading-sm title. */
export const Top: Story = {
  render: () => (
    <Gallery>
      <Specimen label="양쪽 아이콘 버튼">
        <div className="w-[360px]">
          <TopNavigation
            title="맛집 상세"
            leading={{ name: "chevron-left", label: "뒤로" }}
            trailing={{ name: "share", label: "공유" }}
          />
        </div>
      </Specimen>
      <Specimen label="좌측만">
        <div className="w-[360px]">
          <TopNavigation
            title="맛집 등록"
            leading={{ name: "close", label: "닫기" }}
          />
        </div>
      </Specimen>
      <Specimen label="아이콘 버튼 없음">
        <div className="w-[360px]">
          <TopNavigation title="숨은 맛집" />
        </div>
      </Specimen>
    </Gallery>
  ),
};

/** 56px, 2–5 items sharing the width evenly. */
export const Bottom: Story = {
  render: () => (
    <Gallery>
      <Specimen label="4개 아이템 · 레이블 있음">
        <div className="w-[360px]">
          <BottomNavigation items={NAV_ITEMS} value={0} />
        </div>
      </Specimen>
      <Specimen label="레이블 없음">
        <div className="w-[360px]">
          <BottomNavigation
            items={NAV_ITEMS.map(({ name }) => ({ name }))}
            value={1}
          />
        </div>
      </Specimen>
      <Specimen label="2개 아이템 (최소)">
        <div className="w-[360px]">
          <BottomNavigation items={NAV_ITEMS.slice(0, 2)} value={1} />
        </div>
      </Specimen>
      <Specimen label="5개 아이템 (최대)">
        <div className="w-[360px]">
          <BottomNavigation
            items={[...NAV_ITEMS, { name: "settings", label: "설정" }]}
            value={4}
          />
        </div>
      </Specimen>
      <Specimen
        label="문서와 디자인 파일 차이"
        description="가이드는 선택 시 '필(채워진)' 아이콘을 요구하지만, design.pen은 색만 브랜드로 바꾸고 아웃라인 글리프를 유지합니다. 코드는 디자인 파일을 따랐습니다."
      >
        <span />
      </Specimen>
    </Gallery>
  ),
};

/** 48px, evenly distributed, 2px indicator under the selected tab. */
export const Tabs: Story = {
  render: () => (
    <Gallery>
      <Specimen label="4개 탭">
        <div className="w-[368px]">
          <TabNavigation
            tabs={[
              { label: "전체" },
              { label: "한식" },
              { label: "카페" },
              { label: "아이동반" },
            ]}
            value={0}
          />
        </div>
      </Specimen>
      <Specimen label="2개 탭 (최소)">
        <div className="w-[240px]">
          <TabNavigation
            tabs={[{ label: "리뷰" }, { label: "메뉴" }]}
            value={1}
          />
        </div>
      </Specimen>
    </Gallery>
  ),
};

/** The three bars in the arrangement a screen would use. */
export const InContext: Story = {
  render: () => (
    <Gallery>
      <div className="flex w-[360px] flex-col overflow-hidden rounded-2xl border border-border-default">
        <TopNavigation
          title="맛집 상세"
          leading={{ name: "chevron-left", label: "뒤로" }}
          trailing={{ name: "bookmark", label: "저장" }}
        />
        <TabNavigation
          tabs={[{ label: "정보" }, { label: "리뷰" }, { label: "메뉴" }]}
          value={1}
        />
        <div className="type-body-md flex h-40 items-center justify-center bg-background-canvas text-neutral-600">
          콘텐츠 영역
        </div>
        <BottomNavigation items={NAV_ITEMS} value={0} />
      </div>
    </Gallery>
  ),
};
