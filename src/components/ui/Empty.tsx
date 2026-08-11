import type { ReactNode } from "react";

import { Icon } from "../foundation/Icon";
import type { IconName } from "../../tokens/icons";

export interface EmptyProps {
  /** Circular visual above the title. Pass null to omit it. */
  icon?: IconName | null;
  title: string;
  description?: string;
  /** Up to one primary and one secondary button. */
  actions?: ReactNode;
  className?: string;
}

/** Empty — design.pen `Empty`. Everything is centred on both axes. */
export function Empty({
  icon = "heart",
  title,
  description,
  actions,
  className,
}: EmptyProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3.5 p-6 ${className ?? ""}`}
    >
      {icon && (
        <div
          className="flex shrink-0 items-center justify-center rounded-full bg-border-default text-text-subtle"
          style={{ width: 72, height: 72 }}
          aria-hidden
        >
          <Icon name={icon} size={32} />
        </div>
      )}
      <h3 className="type-heading-sm text-center text-text-default">{title}</h3>
      {description && (
        <p className="type-body-md text-center text-text-muted">
          {description}
        </p>
      )}
      {actions && <div className="flex justify-center gap-2">{actions}</div>}
    </div>
  );
}
