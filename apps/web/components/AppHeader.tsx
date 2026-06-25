import Link from 'next/link';
import { PILOT_TENANT } from '@/lib/tenant';

/**
 * Branded portal header — reads as an extension of the tenant's site
 * (navy / lime / Poppins). For the pilot that's Change Connected's "Change Hub".
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[var(--color-bg-primary)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* Real Change Connected logo — interlocking mark + white wordmark,
              transparent-keyed for the navy header. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-change-connected.webp"
            alt="Change Connected"
            className="h-7 w-auto"
          />
          <span className="hidden border-l border-white/15 pl-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-secondary)] sm:block">
            {PILOT_TENANT.instanceName}
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/dashboard"
            className="font-semibold text-white/80 transition hover:text-[var(--color-accent)]"
          >
            Collective
          </Link>
          <Link
            href="/dashboard/new"
            className="rounded-full border border-[var(--color-accent)] px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
          >
            + Add consultant
          </Link>
        </nav>
      </div>
    </header>
  );
}
