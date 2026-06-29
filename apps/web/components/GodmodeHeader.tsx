import { FlowencyLogo } from '@/components/FlowencyLogo';

/**
 * Godmode (platform control-plane) header.
 *
 * The godmode surfaces are Flowency-branded, NOT tenant-branded: this is the
 * platform operator's view, so it must never show a tenant's logo (ADR-0013).
 * Renders the Flowency wordmark + the "Bench" product name + a "Godmode" badge,
 * plus who is signed in and a way out. Lives inside `.flowency-godmode`
 * (godmode/layout.tsx), so `--color-*` resolve to the Flowency theme.
 */
export function GodmodeHeader({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[var(--color-bg-primary)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <FlowencyLogo className="h-6 w-auto" />
          <span className="border-l border-white/15 pl-3 text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
            Bench
          </span>
          <span className="rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Godmode
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-[var(--color-text-secondary)] sm:inline">
            {email}
          </span>
          <a
            href="/auth/logout"
            className="text-sm font-semibold text-white/60 transition hover:text-[var(--color-accent)]"
          >
            Sign out
          </a>
        </div>
      </div>
    </header>
  );
}
