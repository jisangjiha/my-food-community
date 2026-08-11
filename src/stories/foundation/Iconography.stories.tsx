import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Icon } from "../../components/foundation/Icon";
import {
  ICON_MAP,
  ICON_NAMES,
  ICON_SIZES,
  RENAMED_ICONS,
} from "../../tokens/icons";
import { DocsTable, TokenName } from "../lib/DocsTable";
import { Unstyled } from "../lib/Unstyled";

const meta = {
  title: "Foundation/Iconography",
  component: Icon,
  parameters: {
    docs: {
      description: {
        component:
          `lucide 아이콘 ${ICON_NAMES.length}종을 ${ICON_SIZES.join("/")} 4개 사이즈로 제공합니다. ` +
          "디자인 시스템은 역할 기준 이름(`home`, `close`)을, lucide는 모양 기준 이름(`house`, `x`)을 쓰기 때문에 " +
          "Icon 컴포넌트는 **디자인 시스템 이름**을 받습니다. 색은 `currentColor`를 따릅니다.",
      },
    },
  },
  args: { name: "heart", size: 24 },
  argTypes: {
    name: { control: "select", options: ICON_NAMES },
    size: { control: "inline-radio", options: ICON_SIZES },
    className: { control: "text" },
    label: { control: "text" },
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Single icon, driven by controls. */
export const Playground: Story = {};

/** One row per icon, all four sizes — the layout of the design file's frame. */
export const AllIcons: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Unstyled>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-6 gap-y-1 p-4">
        {ICON_NAMES.map((name) => (
          <div
            key={name}
            className="flex items-center gap-4 border-b border-border-default py-2"
          >
            <div className="flex w-[104px] shrink-0 items-center gap-2 text-text-default">
              {ICON_SIZES.map((size) => (
                <Icon key={size} name={name} size={size} />
              ))}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="type-label-lg truncate">{name}</span>
              {ICON_MAP[name] !== name && (
                <span className="type-label-md truncate text-neutral-600">
                  lucide: {ICON_MAP[name]}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Unstyled>
  ),
};

/** Size comparison for a single icon. */
export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Unstyled>
      <div className="flex items-end gap-8 p-4 text-text-default">
        {ICON_SIZES.map((size) => (
          <div key={size} className="flex flex-col items-center gap-2">
            <Icon name="star" size={size} />
            <span className="type-label-md text-neutral-600">{size}px</span>
          </div>
        ))}
      </div>
    </Unstyled>
  ),
};

/** Icons take their colour from the surrounding text colour. */
export const Colors: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Unstyled>
      <div className="flex flex-wrap gap-6 p-4">
        {(
          [
            ["기본", "text-text-default", "info"],
            ["보조", "text-neutral-600", "search"],
            ["브랜드", "text-text-brand", "bookmark"],
            ["성공", "text-text-success", "check"],
            ["경고", "text-text-warning", "warning"],
            ["에러", "text-text-error", "error"],
            ["별점", "text-star", "star"],
          ] as const
        ).map(([label, className, name]) => (
          <div key={label} className="flex flex-col items-center gap-2">
            {/* The colour goes on the icon only. Several of these tokens are
                glyph colours (color-star especially) and fail contrast as text. */}
            <span className={className}>
              <Icon name={name} size={32} />
            </span>
            <span className="type-label-md text-text-default">{label}</span>
          </div>
        ))}
      </div>
    </Unstyled>
  ),
};

/** Where the design system name and the lucide name diverge. */
export const NameMapping: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Unstyled>
      <div className="flex flex-col gap-3 p-4">
        <p className="type-body-md text-neutral-600">
          전체 {ICON_NAMES.length}종 중 이름이 다른 {RENAMED_ICONS.length}종입니다.
          코드에서는 왼쪽 이름을 쓰세요.
        </p>
        <DocsTable
          headers={["", "디자인 시스템 이름", "lucide 이름"]}
          rows={RENAMED_ICONS.map((name) => [
            <span key="i" className="text-text-default">
              <Icon name={name} size={24} />
            </span>,
            <TokenName key="d">{name}</TokenName>,
            <TokenName key="l">{ICON_MAP[name]}</TokenName>,
          ])}
        />
      </div>
    </Unstyled>
  ),
};
