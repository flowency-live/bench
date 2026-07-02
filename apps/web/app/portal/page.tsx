import { redirect } from 'next/navigation';
import { PortalHeader } from '@/components/PortalHeader';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { PortalClient } from './PortalClient';
import { getRepository } from '@/lib/data/repository';
import { getSession } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';
import { getClientRepository } from '@/lib/data/client';

export const dynamic = 'force-dynamic';

/**
 * Client portal collective view.
 *
 * Shows profiles filtered by the client's visibility settings:
 * - all_active: all active profiles
 * - handpicked: only the profiles in handpickedProfileIds
 */
export default async function PortalPage() {
  const session = await getSession();

  // Must be a client session
  if (!session || session.kind !== 'client') {
    redirect('/portal/error?reason=invalid');
  }

  const { tenantId, clientId } = session;

  // Load client to get visibility settings
  const client = await getClientRepository().get(tenantId, clientId);
  if (!client) {
    redirect('/portal/error?reason=invalid');
  }

  // Load tenant for branding
  const tenant = await getTenantRepository().get(tenantId);

  // Load all profiles
  const repo = getRepository();
  const allProfiles = await repo.list(tenantId);

  // Filter to active profiles only
  const activeProfiles = allProfiles.filter((p) => p.status === 'active');

  // Apply visibility filter
  let visibleProfiles = activeProfiles;
  if (client.visibilityMode === 'handpicked') {
    const allowed = new Set(client.handpickedProfileIds);
    visibleProfiles = activeProfiles.filter((p) => allowed.has(p.id));
  }

  return (
    <BrandedWrapper
      tenant={tenant}
      className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
    >
      <PortalHeader />
      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-2 w-2 shrink-0 bg-[var(--color-accent)]" />
            <h1 className="text-base font-bold uppercase tracking-widest text-white sm:text-lg">
              Consultant Portal
            </h1>
          </div>

          {/* Stats */}
          <div className="-mx-4 flex gap-px overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:overflow-visible sm:px-0">
            <div className="flex items-center gap-2 border-y border-l border-r border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 px-3 py-1.5">
              <span className="font-mono text-base font-bold tabular-nums text-white sm:text-lg">
                {visibleProfiles.length.toString().padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Consultants
              </span>
            </div>
          </div>
        </div>

        {/* Profiles grid */}
        <div className="mt-4">
          {visibleProfiles.length === 0 ? (
            <div className="border border-dashed border-white/20 bg-white/[0.02] p-6 text-center sm:p-10">
              <p className="text-sm font-semibold text-white">No consultants available</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Contact your account manager for assistance.
              </p>
            </div>
          ) : (
            <PortalClient profiles={visibleProfiles} />
          )}
        </div>
      </main>
    </BrandedWrapper>
  );
}
