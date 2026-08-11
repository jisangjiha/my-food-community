import type { ReactNode } from "react";

import { Unstyled } from "./Unstyled";

/**
 * Type (row) × state (column) grid — the layout every UI component guide
 * asks for ("정렬: 타입(행) * 상태(열)").
 */
export function Matrix({
  columns,
  rows,
  render,
  rowLabel = (row) => row,
  title,
}: {
  columns: string[];
  rows: string[];
  render: (row: string, column: string) => ReactNode;
  rowLabel?: (row: string) => ReactNode;
  title?: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      {title && (
        <h3 className="type-heading-sm text-text-default">{title}</h3>
      )}
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-x-4 border-spacing-y-3">
          <thead>
            <tr>
              <th />
              {columns.map((column) => (
                <th
                  key={column}
                  className="type-label-md text-left font-normal text-neutral-600"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <th className="type-label-md whitespace-nowrap text-left font-normal text-neutral-600">
                  {rowLabel(row)}
                </th>
                {columns.map((column) => (
                  <td key={column} className="align-middle">
                    {render(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Page wrapper for a component gallery story. */
export function Gallery({ children }: { children: ReactNode }) {
  return (
    <Unstyled>
      <div className="flex flex-col gap-10 p-4">{children}</div>
    </Unstyled>
  );
}

/** A labelled specimen, for components that do not fit a matrix. */
export function Specimen({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="type-label-lg text-text-default">{label}</span>
        {description && (
          <span className="type-label-md text-neutral-600">{description}</span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
