import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  IconButton,
  type IconButtonVariant,
} from "../../components/ui/IconButton";
import { ICON_NAMES, ICON_SIZES } from "../../tokens/icons";
import { Gallery, Matrix, Specimen } from "../lib/Matrix";

const VARIANTS: IconButtonVariant[] = [
  "ghost",
  "circle-brand",
  "circle-neutral",
];

const meta = {
  title: "UI/Action/IconButton",
  component: IconButton,
  parameters: {
    docs: {
      description: {
        component:
          "design.pen의 Ghost / Circle Brand / Circle Neutral 3종입니다. 버튼 박스 48×48, 아이콘 24가 기본값입니다. " +
          "보이는 텍스트가 없으므로 `label`이 필수이며 `aria-label`로 들어갑니다.",
      },
    },
  },
  args: {
    variant: "ghost",
    name: "heart",
    label: "찜하기",
    size: 48,
    iconSize: 24,
  },
  argTypes: {
    variant: { control: "inline-radio", options: VARIANTS },
    name: { control: "select", options: ICON_NAMES },
    iconSize: { control: "inline-radio", options: ICON_SIZES },
    label: { control: "text" },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Type (row) × state (column). */
export const Matrix_: Story = {
  name: "Type × State",
  parameters: { controls: { disable: true } },
  render: () => (
    <Gallery>
      <Matrix
        columns={["default", "disabled"]}
        rows={VARIANTS}
        render={(variant, state) => (
          <IconButton
            variant={variant as IconButtonVariant}
            name="heart"
            label="찜하기"
            disabled={state === "disabled"}
          />
        )}
      />
      <Specimen
        label="주의"
        description="disabled는 디자인 파일에 없는 상태입니다 — 원형 배경은 유지하고 전경색만 낮추도록 코드에서 정했습니다."
      >
        <span />
      </Specimen>
    </Gallery>
  ),
};

/** The design specifies 48×48 with a 24px glyph; other pairings are available. */
export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Gallery>
      <Specimen label="48 / 24" description="디자인 파일 기본값">
        <div className="flex items-center gap-4">
          {VARIANTS.map((variant) => (
            <IconButton
              key={variant}
              variant={variant}
              name="heart"
              label="찜하기"
            />
          ))}
        </div>
      </Specimen>
      <Specimen label="40 / 20" description="탑내비게이션 등 좁은 자리용">
        <div className="flex items-center gap-4">
          {VARIANTS.map((variant) => (
            <IconButton
              key={variant}
              variant={variant}
              name="heart"
              label="찜하기"
              size={40}
              iconSize={20}
            />
          ))}
        </div>
      </Specimen>
    </Gallery>
  ),
};
