import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { getActiveTenant } from '@/lib/brand/resolve';
import { TenantLogo } from '@/components/TenantLogo';

/**
 * Minimal branded header for the client portal.
 *
 * Shows tenant branding and sign out. No navigation since portal
 * is a single-purpose read-only view of the collective.
 */
export async function PortalHeader() {
  const session = await getSession();
  const tenant = await getActiveTenant();

  // Extract contact email for display
  const contactEmail = session?.kind === 'client' ? session.contactEmail : null;

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[var(--color-bg-primary)]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link href="/portal" className="flex items-center gap-3">
          {tenant ? (
            <TenantLogo tenant={tenant} size="lg" />
          ) : (
            <span className="text-lg font-bold text-[var(--color-accent)]">Portal</span>
          )}
        </Link>

        <div className="flex items-center gap-4">
          {contactEmail && (
            <span className="hidden text-xs text-[var(--color-text-secondary)] sm:block">
              {contactEmail}
            </span>
          )}
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
