import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Skeleton } from "../../components/ui/Skeleton";
import { Spinner } from "../../components/ui/Spinner";
import { Toast, type ToastVariant } from "../../components/ui/Toast";
import { Gallery, Matrix, Specimen } from "../lib/Matrix";

const TOAST_VARIANTS: ToastVariant[] = ["success", "error", "info", "warning"];

const TOAST_MESSAGE: Record<ToastVariant, string> = {
  success: "리뷰가 저장되었습니다",
  error: "저장에 실패했어요",
  info: "새로운 맛집 3곳이 등록됐어요",
  warning: "저장 공간이 거의 찼어요",
};

const meta = {
  title: "UI/Feedback",
  parameters: {
    docs: {
      description: {
        component:
          "12-ds-ui-component-feedback.txt의 3개 컴포넌트입니다. Spinner는 브랜드 컬러 24px 링, Skeleton은 뉴트럴, Toast는 4타입입니다.",
      },
    },
    controls: { disable: true },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** 24px ring, 280° sweep, brand colour. */
export const Spinners: Story = {
  render: () => (
    <Gallery>
      <Specimen label="md (24)" description="디자인 파일 사양">
        <span className="text-text-brand">
          <Spinner />
        </span>
      </Specimen>
      <Specimen
        label="다른 크기"
        description="비율(안쪽 반지름 0.72, 스윕 280°)은 유지됩니다."
      >
        <div className="flex items-center gap-4 text-text-brand">
          {[16, 20, 24, 32, 48].map((size) => (
            <Spinner key={size} size={size} label={null} />
          ))}
        </div>
      </Specimen>
      <Specimen label="버튼 안" description="색은 currentColor를 따릅니다.">
        <div className="inline-flex items-center gap-2 rounded-[10px] bg-background-brand px-4 text-text-on-brand" style={{ height: 40 }}>
          <Spinner size={20} label={null} />
          <span className="type-label-lg">저장</span>
        </div>
      </Specimen>
    </Gallery>
  ),
};

/** Three shapes, each sized to whatever it stands in for. */
export const Skeletons: Story = {
  render: () => (
    <Gallery>
      <Specimen label="타입" description="텍스트형 / 사각형 / 원형">
        <div className="flex items-center gap-10">
          <Skeleton variant="text" />
          <Skeleton variant="rect" />
          <Skeleton variant="circle" />
        </div>
      </Specimen>
      <Specimen label="카드 로딩" description="실제 요소 치수에 맞춰 사용">
        <div
          className="flex w-[260px] flex-col overflow-hidden border border-border-default bg-background-surface"
          style={{ borderRadius: 16 }}
        >
          <Skeleton variant="rect" width="100%" height={150} />
          <div className="flex flex-col gap-2 p-3.5">
            <Skeleton variant="text" width={160} height={16} />
            <Skeleton variant="text" width={110} height={12} />
            <Skeleton variant="text" width="100%" height={14} />
          </div>
        </div>
      </Specimen>
      <Specimen label="프로필 로딩">
        <div className="flex items-center gap-3">
          <Skeleton variant="circle" size={40} />
          <div className="flex flex-col gap-1.5">
            <Skeleton variant="text" width={120} height={14} />
            <Skeleton variant="text" width={80} height={12} />
          </div>
        </div>
      </Specimen>
    </Gallery>
  ),
};

/** Type (row) × close button present/absent (column). */
export const Toasts: Story = {
  render: () => (
    <Gallery>
      <Matrix
        title="Toast — 타입 × 닫기 버튼"
        columns={["닫기 있음", "닫기 없음"]}
        rows={TOAST_VARIANTS}
        render={(variant, column) => (
          <div className="w-[400px]">
            <Toast
              variant={variant as ToastVariant}
              onClose={column === "닫기 있음" ? () => {} : undefined}
            >
              {TOAST_MESSAGE[variant as ToastVariant]}
            </Toast>
          </div>
        )}
      />
      <Specimen
        label="모바일 폭"
        description="모바일은 화면 너비에서 좌우 마진을 뺀 값, 데스크톱은 400px 고정입니다."
      >
        <div className="w-[328px]">
          <Toast variant="success" onClose={() => {}}>
            리뷰가 저장되었습니다
          </Toast>
        </div>
      </Specimen>
    </Gallery>
  ),
};
