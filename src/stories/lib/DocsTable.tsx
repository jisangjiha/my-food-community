import type { ReactNode } from "react";

/** Plain table shared by the foundation docs pages. */
export function DocsTable({
  headers,
  rows,
}: {
  headers: ReactNode[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse type-body-md">
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th
                key={i}
                className="border-b border-border-strong px-3 py-2 text-left type-label-lg text-neutral-600"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r}>
              {cells.map((cell, c) => (
                <td
                  key={c}
                  className="border-b border-border-default px-3 py-2 align-middle"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Monospace token name. */
export function TokenName({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-background-subtle px-1.5 py-0.5 font-mono text-[13px] text-text-default">
      {children}
    </code>
  );
}
