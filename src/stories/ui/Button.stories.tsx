import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  BUTTON_SIZES,
  Button,
  type ButtonSize,
  type ButtonVariant,
} from "../../components/ui/Button";
import { ICON_NAMES } from "../../tokens/icons";
import { DocsTable, TokenName } from "../lib/DocsTable";
import { Gallery, Matrix, Specimen } from "../lib/Matrix";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "destructive"];
const SIZES: ButtonSize[] = ["lg", "md", "sm"];
const STATES = ["default", "disabled", "loading"] as const;

/** Label and leading icon per variant, matching design.pen. */
const SAMPLE = {
  primary: { label: "저장", icon: "check" },
  secondary: { label: "공유", icon: "share" },
  destructive: { label: "삭제", icon: "delete" },
} as const;

const meta = {
  title: "UI/Action/Button",
  component: Button,
  parameters: {
    docs: {
      description: {
        component:
          "3타입(primary / secondary / destructive) × 3상태(default / disabled / loading) × 3사이즈(sm 32 / md 40 / lg 48). " +
          "loading은 좌측 아이콘만 스피너로 바뀌고 레이블은 유지됩니다. 레이블은 label-lg 고정입니다.",
      },
    },
  },
  args: {
    variant: "primary",
    size: "md",
    children: "저장",
    leadingIcon: "check",
    loading: false,
    disabled: false,
  },
  argTypes: {
    variant: { control: "inline-radio", options: VARIANTS },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    leadingIcon: { control: "select", options: [undefined, ...ICON_NAMES] },
    trailingIcon: { control: "select", options: [undefined, ...ICON_NAMES] },
    children: { control: "text" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Type (row) × state (column), repeated per size. */
export const Matrix_: Story = {
  name: "Type × State",
  parameters: { controls: { disable: true } },
  render: () => (
    <Gallery>
      {VARIANTS.map((variant) => (
        <Matrix
          key={variant}
          title={variant}
          columns={[...STATES]}
          rows={SIZES}
          rowLabel={(size) => `${size} (${BUTTON_SIZES[size as ButtonSize].height})`}
          render={(size, state) => (
            <Button
              variant={variant}
              size={size as ButtonSize}
              disabled={state === "disabled"}
              loading={state === "loading"}
              leadingIcon={SAMPLE[variant].icon}
            >
              {SAMPLE[variant].label}
            </Button>
          )}
        />
      ))}
    </Gallery>
  ),
};

/** Icons are optional on either side; the size follows the button size. */
export const Icons: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Gallery>
      <Specimen label="아이콘 없음">
        <div className="flex flex-wrap items-center gap-3">
          {SIZES.map((size) => (
            <Button key={size} size={size}>
              저장
            </Button>
          ))}
        </div>
      </Specimen>
      <Specimen label="좌측 아이콘">
        <div className="flex flex-wrap items-center gap-3">
          {SIZES.map((size) => (
            <Button key={size} size={size} leadingIcon="check">
              저장
            </Button>
          ))}
        </div>
      </Specimen>
      <Specimen label="우측 아이콘">
        <div className="flex flex-wrap items-center gap-3">
          {SIZES.map((size) => (
            <Button key={size} size={size} trailingIcon="chevron-right">
              다음
            </Button>
          ))}
        </div>
      </Specimen>
      <Specimen label="양쪽 아이콘">
        <div className="flex flex-wrap items-center gap-3">
          {SIZES.map((size) => (
            <Button
              key={size}
              size={size}
              leadingIcon="filter"
              trailingIcon="chevron-down"
            >
              필터
            </Button>
          ))}
        </div>
      </Specimen>
    </Gallery>
  ),
};

/** The measurements taken from the design file. */
export const Specs: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Gallery>
      <DocsTable
        headers={["사이즈", "높이", "라운드", "좌우 패딩", "갭", "아이콘"]}
        rows={(["sm", "md", "lg"] as ButtonSize[]).map((size) => {
          const spec = BUTTON_SIZES[size];
          return [
            <TokenName key="s">{size}</TokenName>,
            `${spec.height}px`,
            `${spec.radius}px`,
            `${spec.paddingX}px`,
            `${spec.gap}px`,
            `${spec.icon}px`,
          ];
        })}
      />
      <p className="type-body-md text-neutral-600">
        라운드 값은 디자인 파일에 토큰이 없어 리터럴로 들어 있습니다. 다른 값은
        모두 시맨틱 색상 토큰과 타이포 토큰을 씁니다.
      </p>
    </Gallery>
  ),
};
