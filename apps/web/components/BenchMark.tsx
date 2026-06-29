/**
 * Bench product wordmark — the OpStack-family platform identity (purple/violet
 * gradient stacked bars + "Bench"). Used on the public landing and the pre-auth
 * /login screen. This is the PLATFORM brand, never a tenant's — pre-auth
 * visitors must always see Bench, not a tenant (ADR-0013).
 */
export function BenchMark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="bench-mark" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5e44e4" />
            <stop offset="1" stopColor="#b152e0" />
          </linearGradient>
        </defs>
        <rect x="3" y="5" width="22" height="5" rx="2.5" fill="url(#bench-mark)" />
        <rect x="3" y="12.5" width="22" height="5" rx="2.5" fill="url(#bench-mark)" opacity="0.7" />
        <rect x="3" y="20" width="22" height="5" rx="2.5" fill="url(#bench-mark)" opacity="0.4" />
      </svg>
      <span className="text-xl font-extrabold tracking-tight">Bench</span>
    </span>
  );
}
