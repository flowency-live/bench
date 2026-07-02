import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { PortalHeader } from '@/components/PortalHeader';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { ProfileRenderer } from '@/components/ProfileRenderer';
import { getRepository } from '@/lib/data/repository';
import { getSession } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';
import { getClientRepository, getClientActivityRepository } from '@/lib/data/client';

export const dynamic = 'force-dynamic';

/**
 * Portal profile detail page.
 *
 * Read-only view of a consultant profile for client contacts.
 * Logs view activity and provides PDF export.
 */
export default async function PortalProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const session = await getSession();

  // Must be a client session
  if (!session || session.kind !== 'client') {
    redirect('/portal/error?reason=invalid');
  }

  const { tenantId, clientId, contactId, contactEmail } = session;
  const { profileId } = await params;

  // Load client to check visibility
  const client = await getClientRepository().get(tenantId, clientId);
  if (!client) {
    redirect('/portal/error?reason=invalid');
  }

  // Load the profile
  const profile = await getRepository().get(tenantId, profileId);
  if (!profile) notFound();

  // Check profile is active
  if (profile.status !== 'active') {
    notFound();
  }

  // Check client has access to this profile
  if (client.visibilityMode === 'handpicked') {
    const allowed = new Set(client.handpickedProfileIds);
    if (!allowed.has(profileId)) {
      notFound();
    }
  }

  // Load tenant for branding
  const tenant = await getTenantRepository().get(tenantId);

  // Log view activity (fire and forget)
  getClientActivityRepository()
    .log(tenantId, {
      clientId,
      contactId,
      contactEmail,
      profileId,
      eventType: 'view',
    })
    .catch(() => {
      // Non-critical, ignore errors
    });

  return (
    <BrandedWrapper
      tenant={tenant}
      className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
    >
      <PortalHeader />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Action bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <Link
            href="/portal"
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-accent)]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to all consultants
          </Link>

          <Link
            href={`/portal/profile/${profileId}/print`}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              />
            </svg>
            Download PDF
          </Link>
        </div>

        {/* Profile content */}
        <ProfileRenderer profile={profile} tenant={tenant} />
      </main>
    </BrandedWrapper>
  );
}
