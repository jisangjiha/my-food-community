/**
 * The Google "G", handed off 1:1 from the four paths in design.pen's
 * `00 Login Page - Google` screen.
 *
 * It lives outside `components/foundation/Icon` on purpose: the design system's
 * icon set is 36 named, single-colour lucide glyphs, and this is a four-colour
 * third-party trademark. Keeping it here means `Icon` stays a closed set and
 * Google's mark keeps its required colours.
 */

export interface GoogleMarkProps {
  /** Square size in px. The login button draws it at 18. */
  size?: number;
  className?: string;
}

export function GoogleMark({ size = 18, className }: GoogleMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-0.14-3.06-0.4-4.5h-20.72v8.51h11.84c-0.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07h-7.35v5.7c3.62 7.19 11.06 12.12 19.66 12.12z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-0.44-1.32-0.69-2.73-0.69-4.18s0.25-2.86 0.69-4.18v-5.7h-7.35c-1.49 2.97-2.34 6.33-2.34 9.88s0.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31c-3.81-3.55-8.79-5.73-14.72-5.73-8.6 0-16.04 4.93-19.66 12.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
