import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge, type BadgeSize, type BadgeVariant } from "../../components/ui/Badge";
import { BottomSheet, BottomSheetOption } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Empty } from "../../components/ui/Empty";
import { Menu, MenuItem, type MenuItemVariant } from "../../components/ui/Menu";
import { Modal } from "../../components/ui/Modal";
import type { FieldSize } from "../../components/ui/field";
import { Gallery, Matrix, Specimen } from "../lib/Matrix";

const BADGE_VARIANTS: BadgeVariant[] = [
  "neutral",
  "brand",
  "success",
  "error",
  "info",
  "warning",
];

const BADGE_LABEL: Record<BadgeVariant, string> = {
  neutral: "기본",
  brand: "예정",
  success: "완료",
  error: "실패",
  info: "안내",
  warning: "주의",
};

const meta = {
  title: "UI/Etc",
  parameters: {
    docs: {
      description: {
        component:
          "13-ds-ui-component-etc.txt의 7개 컴포넌트입니다. Card / Badge / Empty / Modal / BottomSheet / Menu / MenuItem.",
      },
    },
    controls: { disable: true },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const PHOTO =
  "https://images.unsplash.com/photo-1773113634819-8869cc893ea3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

export const Cards: Story = {
  render: () => (
    <Gallery>
      <Specimen label="이미지 포함">
        <div className="w-[260px]">
          <Card
            image={
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={PHOTO}
                alt="파스타 접시"
                className="h-full w-full object-cover"
              />
            }
            title="조용한 골목 파스타"
            meta="항동 · 주차 가능 · 4.8"
            description="차로 18분, 이웃이 추천한 골목 맛집이에요."
          />
        </div>
      </Specimen>
      <Specimen label="이미지 제외">
        <div className="w-[260px]">
          <Card
            title="조용한 골목 파스타"
            meta="항동 · 주차 가능 · 4.8"
            description="차로 18분, 이웃이 추천한 골목 맛집이에요."
          />
        </div>
      </Specimen>
      <Specimen label="자유 콘텐츠">
        <div className="w-[260px]">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <span className="type-heading-sm text-text-default">
                이번 주 저장
              </span>
              <Badge variant="success">완료</Badge>
            </div>
            <p className="type-body-md text-text-default">12곳</p>
          </Card>
        </div>
      </Specimen>
    </Gallery>
  ),
};

/** Type (row) × size (column). */
export const Badges: Story = {
  render: () => (
    <Gallery>
      <Matrix
        title="Badge — 타입 × 사이즈"
        columns={["md (20)", "lg (24)"]}
        rows={BADGE_VARIANTS}
        render={(variant, column) => (
          <Badge
            variant={variant as BadgeVariant}
            size={(column.startsWith("md") ? "md" : "lg") as BadgeSize}
          >
            {BADGE_LABEL[variant as BadgeVariant]}
          </Badge>
        )}
      />
    </Gallery>
  ),
};

/**
 * 톤 — `outline`은 design.pen `Badge`, `soft`는 결제·취소 내역의 상태 칩입니다.
 * `brand`는 시안의 Badge 세트에는 없지만 `참여 예정` 칩이 이 조합입니다.
 */
export const BadgeTones: Story = {
  render: () => (
    <Gallery>
      {(["outline", "soft"] as const).map((tone) => (
        <Specimen key={tone} label={tone} description="lg (24)">
          <div className="flex flex-wrap items-center gap-2">
            {BADGE_VARIANTS.map((variant) => (
              <Badge key={variant} variant={variant} tone={tone} size="lg">
                {BADGE_LABEL[variant]}
              </Badge>
            ))}
          </div>
        </Specimen>
      ))}
    </Gallery>
  ),
};

export const Empties: Story = {
  render: () => (
    <Gallery>
      <Specimen label="비주얼 + 설명 + 액션 (전체)">
        <div className="w-[340px] border border-border-default" style={{ borderRadius: 16 }}>
          <Empty
            icon="heart"
            title="저장한 맛집이 없어요"
            description="마음에 드는 맛집을 저장해 보세요."
            actions={
              <>
                <Button variant="primary">맛집 찾기</Button>
                <Button variant="secondary">둘러보기</Button>
              </>
            }
          />
        </div>
      </Specimen>
      <Specimen label="제목만">
        <div className="w-[340px] border border-border-default" style={{ borderRadius: 16 }}>
          <Empty icon={null} title="검색 결과가 없어요" />
        </div>
      </Specimen>
    </Gallery>
  ),
};

export const Modals: Story = {
  render: () => (
    <Gallery>
      <Specimen label="헤더 + 바디 + 푸터" description="스크림을 탭하면 닫힙니다.">
        <div className="w-[440px] overflow-hidden" style={{ borderRadius: 12 }}>
          <Modal
            title="변경사항을 저장할까요?"
            actions={
              <>
                <Button variant="secondary">취소</Button>
                <Button variant="primary">저장</Button>
              </>
            }
          >
            저장하지 않은 내용은 사라져요.
          </Modal>
        </div>
      </Specimen>
    </Gallery>
  ),
};

export const BottomSheets: Story = {
  render: () => (
    <Gallery>
      <Specimen
        label="핸들 + 콘텐츠"
        description="스크림을 탭하면 선택 없이 닫힙니다."
      >
        <div className="h-[420px] w-[360px] overflow-hidden" style={{ borderRadius: 12 }}>
          <BottomSheet title="정렬 방식" className="h-auto">
            <div className="flex flex-col gap-0.5">
              <BottomSheetOption>가까운 순</BottomSheetOption>
              <BottomSheetOption>저장 많은 순</BottomSheetOption>
              <BottomSheetOption>최신 순</BottomSheetOption>
            </div>
          </BottomSheet>
        </div>
      </Specimen>
    </Gallery>
  ),
};

/** Type (row) × state (column), for each of the three sizes. */
export const Menus: Story = {
  render: () => (
    <Gallery>
      {(["lg", "md", "sm"] as FieldSize[]).map((size) => (
        <Matrix
          key={size}
          title={`MenuItem — ${size}`}
          columns={["default", "disabled"]}
          rows={["default", "destructive"]}
          render={(variant, state) => (
            // role="menuitem" is only valid inside a menu, so each specimen
            // gets its own container rather than sitting in a bare div.
            <div
              role="menu"
              className="w-[200px] rounded-xl border border-border-default bg-background-surface p-1.5"
            >
              <MenuItem
                variant={variant as MenuItemVariant}
                size={size}
                icon={variant === "destructive" ? "delete" : "edit"}
                disabled={state === "disabled"}
              >
                {variant === "destructive" ? "삭제하기" : "수정하기"}
              </MenuItem>
            </div>
          )}
        />
      ))}
      <Specimen label="Menu" description="메뉴 버튼 아래에 붙는 패널">
        <div className="w-[220px]">
          <Menu>
            <MenuItem icon="edit">수정하기</MenuItem>
            <MenuItem icon="share">공유하기</MenuItem>
            <MenuItem icon="bookmark" disabled>
              저장하기
            </MenuItem>
            <MenuItem variant="destructive" icon="delete">
              삭제하기
            </MenuItem>
          </Menu>
        </div>
      </Specimen>
    </Gallery>
  ),
};
