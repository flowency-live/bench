import Link from 'next/link';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';
import { TenantLogo } from '@/components/TenantLogo';
import { getActiveTenant } from '@/lib/brand/resolve';

/**
 * Branded portal header (ADR-0013).
 *
 * Dynamically renders the tenant's logo/wordmark and name.
 * Always surfaces WHO is signed in and a way out: an admin shows their email
 * (linking to account settings); a switched-in platform (godmode) session shows
 * a "godmode" badge and a way back. Sign out is always present.
 */
export async function AppHeader() {
  const session = await getSession();
  const isAdmin = session?.kind === 'admin';
  const isPlatform = session?.kind === 'platform';
  const isMember = session?.kind === 'member';
  // Only admin sessions have email (members use profileId, platform is handled separately)
  const email = isAdmin ? session.email : null;

  // Resolve tenant for branding
  const tenant = await getActiveTenant();

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[var(--color-bg-primary)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          {tenant ? (
            <TenantLogo tenant={tenant} size="sm" />
          ) : (
            <span className="text-lg font-bold text-[var(--color-accent)]">Bench</span>
          )}
        </Link>

        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/dashboard"
            className="font-semibold text-white/80 transition hover:text-[var(--color-accent)]"
          >
            Collective
          </Link>
          {(isAdmin || isPlatform) && (
            <Link
              href="/team"
              className="hidden font-semibold text-white/80 transition hover:text-[var(--color-accent)] sm:block"
            >
              Team
            </Link>
          )}
          <Link
            href="/dashboard/new"
            className="rounded-full border border-[var(--color-accent)] px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
          >
            + Add consultant
          </Link>

          {/* Account cluster — who am I + the way out */}
          {session && (
            <div className="hidden items-center gap-3 border-l border-white/15 pl-5 sm:flex">
              {isPlatform ? (
                <>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    Godmode
                  </span>
                  <Link
                    href="/godmode"
                    className="text-sm font-semibold text-white/60 transition hover:text-[var(--color-accent)]"
                  >
                    Back to godmode
                  </Link>
                </>
              ) : isAdmin ? (
                <Link
                  href="/settings"
                  title="Account settings"
                  className="text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-accent)]"
                >
                  {email}
                </Link>
              ) : isMember ? (
                <span className="text-xs text-[var(--color-text-secondary)]">Consultant</span>
              ) : null}
              <a
                href="/auth/logout"
                className="text-sm font-semibold text-white/60 transition hover:text-[var(--color-accent)]"
              >
                Sign out
              </a>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
