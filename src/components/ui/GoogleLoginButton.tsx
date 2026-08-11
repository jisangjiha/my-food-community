import Link from "next/link";

import { GoogleMark } from "../brand/GoogleMark";

export interface GoogleLoginButtonProps {
  /** Where to land after sign-in. */
  href: string;
  className?: string;
}

/**
 * The sign-in control from design.pen's `00 Login Page - Google`.
 *
 * Not a `Button` variant: the design draws it 52px tall with a 12px radius and
 * a soft shadow, none of which are on the button scale (32/40/48, radius
 * 8/10/12, no shadow). It is a third-party sign-in control with its own
 * required mark, so it stays a component of its own rather than bending the
 * button spec. Colours, type and border still come from the design tokens.
 */
export function GoogleLoginButton({ href, className }: GoogleLoginButtonProps) {
  return (
    <Link
      href={href}
      className={`flex h-13 w-full items-center justify-center gap-2.5 rounded-xl border border-border-strong bg-background-surface type-label-lg text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand ${className ?? ""}`}
      style={{ boxShadow: "0 2px 8px #5B3A620F" }}
    >
      <GoogleMark size={18} />
      Google로 계속하기
    </Link>
  );
}
