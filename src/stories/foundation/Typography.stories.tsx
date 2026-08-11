import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Text } from "../../components/foundation/Text";
import {
  TEXT_VARIANTS,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  typeStyles,
} from "../../tokens/typography";
import { TokenName } from "../lib/DocsTable";
import { Unstyled } from "../lib/Unstyled";

/** Sample copy per variant, matching the text in design.pen. */
const SAMPLES: Record<string, string> = {
  "display-lg": "디스플레이 라지 Display Large",
  "display-md": "디스플레이 미디엄 Display Medium",
  "display-sm": "디스플레이 스몰 Display Small",
  "heading-lg": "헤딩 라지 Heading Large",
  "heading-md": "헤딩 미디엄 Heading Medium",
  "heading-sm": "헤딩 스몰 Heading Small",
  "body-lg": "숨은 맛집을 발견하는 즐거움 Body Large",
  "body-md": "동네 사람들이 진짜 추천하는 로컬 맛집 Body Medium",
  "label-lg": "라벨 라지 Label Large",
  "label-md": "라벨 미디엄 Label Medium",
};

const meta = {
  title: "Foundation/Typography",
  component: Text,
  parameters: {
    docs: {
      description: {
        component:
          "design.pen의 텍스트 컴포넌트 10종과 1:1로 대응합니다. 모든 스타일의 자간은 -2%로 공통이며, " +
          "각 스타일은 `.type-<variant>` 클래스로 정의되어 있고 토큰 변수만으로 구성됩니다.",
      },
    },
  },
  args: {
    variant: "body-lg",
    children: "숨은 맛집을 발견하는 즐거움",
  },
  argTypes: {
    variant: {
      control: "select",
      options: TEXT_VARIANTS,
      description: "10종 타입 스타일",
    },
    as: { control: false },
    children: { control: "text" },
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Single style, driven by controls. */
export const Playground: Story = {};

/** One row per style, annotated with the tokens it is built from. */
export const Scale: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Unstyled>
      <div className="flex flex-col gap-6 p-4">
        {TEXT_VARIANTS.map((variant) => {
          const style = typeStyles[variant];
          return (
            <div
              key={variant}
              className="flex flex-col gap-2 border-b border-border-default pb-6 last:border-b-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <TokenName>{variant}</TokenName>
                <span className="type-label-md text-neutral-600">
                  {style.designName}
                </span>
                <span className="type-label-md text-neutral-600">
                  {fontSize[style.sizeToken]}px ·{" "}
                  {fontWeight[style.weightToken]} ·{" "}
                  {lineHeight[style.lineHeightToken]} · {letterSpacing}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <TokenName>{style.sizeToken}</TokenName>
                <TokenName>{style.weightToken}</TokenName>
                <TokenName>{style.lineHeightToken}</TokenName>
              </div>
              <Text variant={variant}>{SAMPLES[variant]}</Text>
            </div>
          );
        })}
      </div>
    </Unstyled>
  ),
};

/** The same styles in a realistic block, to judge rhythm rather than specimens. */
export const InContext: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Unstyled>
      <article className="flex max-w-[640px] flex-col gap-4 p-4">
        <Text variant="label-md" className="text-text-brand">
          로컬 맛집
        </Text>
        <Text variant="display-sm">숨은 맛집을 발견하는 즐거움</Text>
        {/* neutral-600, not the muted token: color-text-muted only reaches
            3.98:1 on the default background. See Foundation/Colors. */}
        <Text variant="body-lg" className="text-neutral-600">
          동네 사람들이 진짜 추천하는 가게만 모았습니다. 리뷰 수보다 다녀온
          사람의 이야기를 먼저 보여드립니다.
        </Text>
        {/* display-sm renders an h2, so the next level down must be h3 —
            the variant's default tag (h4) would skip a level. */}
        <Text variant="heading-md" as="h3">
          이번 주 추천
        </Text>
        <Text variant="body-md">
          걸어서 갈 수 있는 거리의 가게 12곳을 골랐습니다. 영업시간과 휴무일은
          매주 월요일에 갱신됩니다.
        </Text>
        <Text variant="label-lg" className="text-neutral-600">
          2026년 7월 30일 업데이트
        </Text>
      </article>
    </Unstyled>
  ),
};
