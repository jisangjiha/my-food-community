import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Icon } from "../foundation/Icon";
import {
  buttonAppearance,
  type ButtonSize,
  type ButtonVariant,
} from "./Button";
import type { IconName } from "../../tokens/icons";

export interface ButtonLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  children?: ReactNode;
}

/**
 * A `Button` that navigates. Same geometry and tokens as `Button` — both read
 * from `buttonAppearance` — but it renders an anchor, so it can sit inside a
 * link context without nesting a `<button>` in an `<a>`.
 *
 * There is no `loading` or `disabled`: a link that cannot be followed should be
 * a `Button` instead.
 */
export function ButtonLink({
  variant = "primary",
  size = "md",
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const look = buttonAppearance(variant, size, { className });

  return (
    <Link className={look.className} style={look.style} {...rest}>
      {leadingIcon && <Icon name={leadingIcon} size={look.iconSize} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size={look.iconSize} />}
    </Link>
  );
}
