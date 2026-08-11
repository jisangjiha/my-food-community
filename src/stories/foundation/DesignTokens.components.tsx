import { useSyncExternalStore } from "react";

import {
  PALETTE_NAMES,
  PALETTE_STEPS,
  primitives,
  resolvePrimitive,
  semantics,
  type SemanticGroup,
} from "../../tokens/color";
import { SPACING_TOKENS, spacing, spacingUsage } from "../../tokens/spacing";
import { fontSize, fontWeight, lineHeight } from "../../tokens/typography";
import { DocsTable, TokenName } from "../lib/DocsTable";
import { Unstyled } from "../lib/Unstyled";
import { cssVarIsDefined, resolveCssVarColor } from "../lib/color";

/** Every colour token paired with the hex the TS mirror says it should be. */
function expectedColorTokens(): { name: string; expected: string }[] {
  const out: { name: string; expected: string }[] = [];
  for (const palette of PALETTE_NAMES) {
    for (const step of PALETTE_STEPS) {
      out.push({
        name: `color-${palette}-${step}`,
        expected: primitives[palette][step].toUpperCase(),
      });
    }
  }
  for (const group of Object.keys(semantics) as SemanticGroup[]) {
    for (const [name, ref] of Object.entries(semantics[group])) {
      out.push({ name, expected: resolvePrimitive(ref).toUpperCase() });
    }
  }
  return out;
}

interface CheckResult {
  total: number;
  missing: string[];
  mismatched: { name: string; expected: string; actual: string }[];
}

/**
 * Compares every token in the TS mirror against what the stylesheet actually
 * paints. Catches drift between `src/tokens/*.ts` and `globals.css`.
 */
function runCheck(): CheckResult {
  const tokens = expectedColorTokens();
  const missing: string[] = [];
  const mismatched: CheckResult["mismatched"] = [];

  for (const { name, expected } of tokens) {
    if (!cssVarIsDefined(`--${name}`)) {
      missing.push(name);
      continue;
    }
    const actual = resolveCssVarColor(`--${name}`);
    if (actual !== expected) {
      mismatched.push({ name, expected, actual: actual ?? "?" });
    }
  }

  return { total: tokens.length, missing, mismatched };
}

/** Memoised so getSnapshot returns a stable reference across renders. */
let cachedResult: CheckResult | null = null;

const subscribe = () => () => {};
const getSnapshot = () => (cachedResult ??= runCheck());
const getServerSnapshot = () => null;

/**
 * The check has to read the stylesheet, which only exists in the browser.
 * `useSyncExternalStore` is the sanctioned way to read a browser-only value
 * without a setState-inside-effect round trip.
 */
function useTokenConsistency(): CheckResult | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function ConsistencyReport() {
  const result = useTokenConsistency();

  if (!result) {
    return <p className="type-body-md text-neutral-600">검사 중…</p>;
  }

  const ok = result.missing.length === 0 && result.mismatched.length === 0;

  return (
    <div
      className={`rounded-lg border p-4 ${
        ok
          ? "border-border-success bg-background-success"
          : "border-border-error bg-background-error"
      }`}
    >
      <p
        className={`type-label-lg ${ok ? "text-text-success" : "text-text-error"}`}
      >
        {ok
          ? `색상 토큰 ${result.total}개 모두 일치`
          : `색상 토큰 ${result.total}개 중 문제 ${
              result.missing.length + result.mismatched.length
            }개`}
      </p>

      {result.missing.length > 0 && (
        <p className="mt-2 type-body-md text-text-error">
          CSS 변수 없음: {result.missing.join(", ")}
        </p>
      )}

      {result.mismatched.length > 0 && (
        <ul className="mt-2 list-disc pl-5">
          {result.mismatched.map((m) => (
            <li key={m.name} className="type-body-md text-text-error">
              <TokenName>{m.name}</TokenName> — TS <code>{m.expected}</code> vs
              CSS <code>{m.actual}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TokenOverview() {
  const semanticCount = (Object.keys(semantics) as SemanticGroup[]).reduce(
    (sum, group) => sum + Object.keys(semantics[group]).length,
    0,
  );
  const typographyCount =
    Object.keys(fontSize).length +
    Object.keys(fontWeight).length +
    Object.keys(lineHeight).length +
    1;

  return (
    <Unstyled>
      <div className="flex flex-col gap-6">
        <DocsTable
          headers={["그룹", "개수", "예시"]}
          rows={[
            [
              "색상 · 프리미티브",
              `${PALETTE_NAMES.length * PALETTE_STEPS.length}`,
              <TokenName key="p">color-brand-600</TokenName>,
            ],
            [
              "색상 · 시맨틱",
              `${semanticCount}`,
              <TokenName key="s">color-text-default</TokenName>,
            ],
            [
              "타이포그래피",
              `${typographyCount}`,
              <TokenName key="t">font-size-300</TokenName>,
            ],
            [
              "스페이싱",
              `${SPACING_TOKENS.length}`,
              <TokenName key="sp">spacing-16</TokenName>,
            ],
          ]}
        />
        <ConsistencyReport />
      </div>
    </Unstyled>
  );
}

export function SpacingScale() {
  return (
    <Unstyled>
      <DocsTable
        headers={["토큰", "값", "", "용도"]}
        rows={SPACING_TOKENS.map((token) => [
          <TokenName key="n">{token}</TokenName>,
          `${spacing[token]}px`,
          <div
            key="bar"
            className="h-4 rounded-sm bg-background-brand"
            style={{ width: spacing[token] }}
          />,
          <span key="u" className="text-neutral-600">
            {spacingUsage[token]}
          </span>,
        ])}
      />
    </Unstyled>
  );
}
