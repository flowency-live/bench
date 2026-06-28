/**
 * Flowency wordmark — used in the godmode (platform / control-plane) surfaces,
 * which are Flowency-branded, NOT tenant-branded (the tenant logo is `Logo`).
 *
 * Brand: matches www.flowency.co.uk — "flowency" wordmark in Plus Jakarta Sans
 * (inherited from the godmode theme), with the terracotta→teal flow mark.
 *
 * The `<text>` inherits the font-family from the surrounding `.flowency-godmode`
 * theme (Plus Jakarta Sans). To use the *official* logotype instead, drop the
 * file at `public/flowency-logo.svg` and swap this for an `<img>`.
 */
export function FlowencyLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 224 44"
      fill="none"
      role="img"
      aria-label="Flowency"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="fl-mark" x1="2" y1="6" x2="38" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c2724e" />
          <stop offset="1" stopColor="#4f8a96" />
        </linearGradient>
      </defs>
      {/* Flow mark — two stacked waves (terracotta → teal) */}
      <path d="M3 16c6-9 12-9 17 0s11 9 17 0" stroke="url(#fl-mark)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M3 27c6-9 12-9 17 0s11 9 17 0" stroke="url(#fl-mark)" strokeWidth="3.4" strokeLinecap="round" opacity=".5" />
      {/* Wordmark */}
      <text x="52" y="32" fontSize="30" fontWeight="800" letterSpacing="-1.2" fill="#f0f1f3">
        flowency
      </text>
    </svg>
  );
}
