import type { ReactNode } from "react";

import { Icon } from "../foundation/Icon";
import { IconButton } from "./IconButton";
import type { IconName } from "../../tokens/icons";

/* ── TopNavigation ─────────────────────────────────────────────────────── */

export interface TopNavigationProps {
  title: string;
  /** Optional leading action, e.g. back. */
  leading?: { name: IconName; label: string; onClick?: () => void };
  /** Optional trailing action, e.g. share. */
  trailing?: { name: IconName; label: string; onClick?: () => void };
  className?: string;
}

/** 56px bar with an optional icon button on each side. */
export function TopNavigation({
  title,
  leading,
  trailing,
  className,
}: TopNavigationProps) {
  return (
    <header
      className={`flex w-full items-center justify-between border-b border-border-default bg-background-surface px-2 ${className ?? ""}`}
      style={{ height: 56 }}
    >
      <span className="flex w-10 justify-start">
        {leading && (
          <IconButton
            name={leading.name}
            label={leading.label}
            onClick={leading.onClick}
            size={40}
            iconSize={24}
          />
        )}
      </span>

      <h1 className="type-heading-sm truncate text-text-default">{title}</h1>

      {/* Mirrors the leading slot so the title stays centred when one side is empty. */}
      <span className="flex w-10 justify-end">
        {trailing && (
          <IconButton
            name={trailing.name}
            label={trailing.label}
            onClick={trailing.onClick}
            size={40}
            iconSize={24}
            className="text-text-brand-strong"
          />
        )}
      </span>
    </header>
  );
}

/* ── BottomNavigation ──────────────────────────────────────────────────── */

export interface BottomNavigationItem {
  name: IconName;
  label?: string;
  href?: string;
  onClick?: () => void;
}

export interface BottomNavigationProps {
  /** 2–5 items, distributed evenly. */
  items: BottomNavigationItem[];
  /** Index of the active item. */
  value?: number;
  className?: string;
}

/**
 * 56px bar, items share the width evenly.
 *
 * The written guide asks for a *filled* glyph when selected; design.pen only
 * changes the colour (brand vs muted) and keeps the outline glyph. This
 * follows the design file — see the story note.
 */
export function BottomNavigation({
  items,
  value = 0,
  className,
}: BottomNavigationProps) {
  return (
    <nav
      className={`flex w-full border-t border-border-default bg-background-surface ${className ?? ""}`}
      style={{ height: 56 }}
    >
      {items.map((item, index) => {
        const selected = index === value;
        return (
          <button
            key={item.label ?? item.name}
            type="button"
            onClick={item.onClick}
            aria-current={selected ? "page" : undefined}
            className={[
              "flex flex-1 cursor-pointer flex-col items-center justify-center gap-[3px]",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-brand",
              selected ? "text-text-brand" : "text-text-muted",
            ].join(" ")}
          >
            <Icon name={item.name} size={24} label={item.label ? undefined : item.name} />
            {item.label && <span className="type-label-md">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}

/* ── TabNavigation ─────────────────────────────────────────────────────── */

export interface TabNavigationProps {
  /** 2 or more tabs, distributed evenly. */
  tabs: { label: string; onClick?: () => void }[];
  value?: number;
  className?: string;
  children?: ReactNode;
}

/** 48px tab strip with a 2px indicator under the selected tab. */
export function TabNavigation({
  tabs,
  value = 0,
  className,
}: TabNavigationProps) {
  return (
    <div
      role="tablist"
      className={`flex w-full border-b border-border-default bg-background-surface ${className ?? ""}`}
      style={{ height: 48 }}
    >
      {tabs.map((tab, index) => {
        const selected = index === value;
        return (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={tab.onClick}
            className={[
              "flex flex-1 cursor-pointer flex-col",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-brand",
              selected ? "text-text-brand" : "text-text-muted",
            ].join(" ")}
          >
            <span className="type-label-lg flex flex-1 items-center justify-center px-4">
              {tab.label}
            </span>
            <span
              aria-hidden
              className={selected ? "bg-background-brand" : "bg-transparent"}
              style={{ height: 2 }}
            />
          </button>
        );
      })}
    </div>
  );
}
