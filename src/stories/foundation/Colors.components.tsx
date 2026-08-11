import {
  PALETTE_NAMES,
  PALETTE_ROLES,
  PALETTE_STEPS,
  primitives,
  resolvePrimitive,
  semantics,
  type PaletteName,
  type SemanticGroup,
} from "../../tokens/color";
import { DocsTable, TokenName } from "../lib/DocsTable";
import { Unstyled } from "../lib/Unstyled";
import { contrastRatio } from "../lib/color";

/** The colour every foreground is checked against, per 05-ds-foundation-color.txt. */
const CHECK_BASE = primitives.neutral[50];

function Swatch({
  hex,
  size = 56,
  label,
}: {
  hex: string;
  size?: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="rounded-md border border-border-default"
        style={{ width: size, height: size, backgroundColor: hex }}
      />
      {label && (
        <span className="type-label-md text-neutral-600 tabular-nums">
          {label}
        </span>
      )}
    </div>
  );
}

/** One row per palette, one square per primitive token. */
export function PrimitivePalettes() {
  return (
    <Unstyled>
      <div className="flex flex-col gap-8">
        {PALETTE_NAMES.map((palette) => (
          <section key={palette} className="flex flex-col gap-3">
            <header className="flex items-baseline gap-3">
              <h3 className="type-heading-sm text-text-default">
                color-{palette}
              </h3>
              <span className="type-body-md text-neutral-600">
                {PALETTE_ROLES[palette]}
              </span>
            </header>
            <div className="flex flex-wrap gap-2">
              {PALETTE_STEPS.map((step) => (
                <Swatch
                  key={step}
                  hex={primitives[palette][step]}
                  label={String(step)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Unstyled>
  );
}

/** Hex reference for one palette. */
export function PaletteHexTable({ palette }: { palette: PaletteName }) {
  return (
    <Unstyled>
      <DocsTable
        headers={["토큰", "값", ""]}
        rows={PALETTE_STEPS.map((step) => [
          <TokenName key="t">{`color-${palette}-${step}`}</TokenName>,
          <span key="h" className="font-mono tabular-nums">
            {primitives[palette][step]}
          </span>,
          <Swatch key="s" hex={primitives[palette][step]} size={24} />,
        ])}
      />
    </Unstyled>
  );
}

function Ratio({ value }: { value: number }) {
  return <span className="font-mono tabular-nums">{value.toFixed(2)}:1</span>;
}

/**
 * The colour guide requires every palette to offer a step that clears 3:1 and
 * one that clears 4.5:1 against neutral-50. This table checks that.
 */
export function ContrastAudit() {
  const rows = PALETTE_NAMES.map((palette) => {
    const ratios = PALETTE_STEPS.map((step) => ({
      step,
      ratio: contrastRatio(primitives[palette][step], CHECK_BASE),
    }));
    const firstAA = ratios.find((r) => r.ratio >= 4.5);
    const firstLarge = ratios.find((r) => r.ratio >= 3);
    const ok = Boolean(firstAA && firstLarge);

    return [
      <TokenName key="p">{`color-${palette}`}</TokenName>,
      <span key="l">
        {firstLarge ? (
          <>
            <strong>{firstLarge.step}</strong> (
            <Ratio value={firstLarge.ratio} />)
          </>
        ) : (
          <span className="text-text-error">없음</span>
        )}
      </span>,
      <span key="a">
        {firstAA ? (
          <>
            <strong>{firstAA.step}</strong> (<Ratio value={firstAA.ratio} />)
          </>
        ) : (
          <span className="text-text-error">없음</span>
        )}
      </span>,
      <span key="ok" className={ok ? "text-text-success" : "text-text-error"}>
        {ok ? "통과" : "미달"}
      </span>,
    ];
  });

  return (
    <Unstyled>
      <DocsTable
        headers={[
          "팔레트",
          "3:1 이상 최초 스텝",
          "4.5:1 이상 최초 스텝",
          "요건 충족",
        ]}
        rows={rows}
      />
    </Unstyled>
  );
}

/** Every step's contrast against neutral-50, for picking a specific value. */
export function ContrastMatrix() {
  return (
    <Unstyled>
      <DocsTable
        headers={["스텝", ...PALETTE_NAMES]}
        rows={PALETTE_STEPS.map((step) => [
          <strong key="s" className="tabular-nums">
            {step}
          </strong>,
          ...PALETTE_NAMES.map((palette) => {
            const ratio = contrastRatio(primitives[palette][step], CHECK_BASE);
            const level = ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA Large" : null;
            return (
              <div key={palette} className="flex flex-col">
                <Ratio value={ratio} />
                <span
                  className={`type-label-md ${
                    level ? "text-text-success" : "text-neutral-600"
                  }`}
                >
                  {level ?? "미달"}
                </span>
              </div>
            );
          }),
        ])}
      />
    </Unstyled>
  );
}

const GROUP_LABELS: Record<SemanticGroup, string> = {
  text: "텍스트",
  background: "배경",
  border: "보더",
  other: "기타",
};

/** Semantic token -> primitive reference -> resolved swatch. */
export function SemanticTokens({ group }: { group: SemanticGroup }) {
  const entries = Object.entries(semantics[group]) as [string, string][];

  return (
    <Unstyled>
      <div className="flex flex-col gap-2">
        <h3 className="type-heading-sm text-text-default">
          {GROUP_LABELS[group]}
        </h3>
        <DocsTable
          headers={["시맨틱 토큰", "참조", "결과", ""]}
          rows={entries.map(([name, ref]) => {
            const hex = resolvePrimitive(ref);
            return [
              <TokenName key="n">{name}</TokenName>,
              <TokenName key="r">{ref}</TokenName>,
              <span key="h" className="font-mono tabular-nums">
                {hex}
              </span>,
              <Swatch key="s" hex={hex} size={24} />,
            ];
          })}
        />
      </div>
    </Unstyled>
  );
}

/**
 * Text/background combinations the design system actually intends to ship.
 * Contrast is computed from the tokens, so it stays honest if a token moves.
 */
const TEXT_PAIRS: [text: string, background: string][] = [
  ["color-text-default", "color-background-default"],
  ["color-text-muted", "color-background-default"],
  ["color-text-subtle", "color-background-default"],
  ["color-text-brand", "color-background-default"],
  ["color-text-brand-strong", "color-background-default"],
  ["color-text-default", "color-background-subtle"],
  ["color-text-muted", "color-background-subtle"],
  ["color-text-default", "color-background-canvas"],
  ["color-text-on-brand", "color-background-brand"],
  ["color-text-on-brand", "color-background-brand-strong"],
  ["color-text-success", "color-background-success"],
  ["color-text-warning", "color-background-warning"],
  ["color-text-error", "color-background-error"],
  ["color-text-info", "color-background-info"],
];

function semanticRef(token: string): string {
  for (const group of Object.keys(semantics) as SemanticGroup[]) {
    const table = semantics[group] as Record<string, string>;
    if (token in table) return table[token];
  }
  throw new Error(`Unknown semantic token: ${token}`);
}

export function TextContrastAudit() {
  const rows = TEXT_PAIRS.map(([text, background]) => {
    const textHex = resolvePrimitive(semanticRef(text));
    const bgHex = resolvePrimitive(semanticRef(background));
    const ratio = contrastRatio(textHex, bgHex);
    const level =
      ratio >= 4.5 ? "AA" : ratio >= 3 ? "큰 텍스트만" : "기준 미달";
    const tone =
      ratio >= 4.5
        ? "text-text-success"
        : ratio >= 3
          ? "text-text-warning"
          : "text-text-error";

    return [
      <TokenName key="t">{text}</TokenName>,
      <TokenName key="b">{background}</TokenName>,
      <span
        key="p"
        className="rounded px-2 py-1"
        style={{ color: textHex, backgroundColor: bgHex }}
      >
        본문 16px
      </span>,
      <Ratio key="r" value={ratio} />,
      <span key="l" className={tone}>
        {level}
      </span>,
    ];
  });

  return (
    <Unstyled>
      <DocsTable
        headers={["텍스트", "배경", "미리보기", "대비", "판정"]}
        rows={rows}
      />
    </Unstyled>
  );
}

/** Semantic pairings rendered as real UI, so contrast is judged in context. */
export function SemanticPairings() {
  const pairs: { label: string; className: string }[] = [
    {
      label: "기본 텍스트 / 기본 배경",
      className: "bg-background-default text-text-default",
    },
    {
      label: "보조 텍스트 / 옅은 배경",
      className: "bg-background-subtle text-text-muted",
    },
    {
      label: "브랜드 위 텍스트",
      className: "bg-background-brand text-text-on-brand",
    },
    {
      label: "강한 브랜드 위 텍스트",
      className: "bg-background-brand-strong text-text-on-brand",
    },
    { label: "성공", className: "bg-background-success text-text-success" },
    { label: "경고", className: "bg-background-warning text-text-warning" },
    { label: "에러", className: "bg-background-error text-text-error" },
    { label: "정보", className: "bg-background-info text-text-info" },
  ];

  return (
    <Unstyled>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {pairs.map((pair) => (
          <div
            key={pair.label}
            className={`rounded-lg border border-border-default p-4 ${pair.className}`}
          >
            <p className="type-label-lg">{pair.label}</p>
            <p className="type-body-md">숨은 맛집을 발견하는 즐거움</p>
          </div>
        ))}
      </div>
    </Unstyled>
  );
}
