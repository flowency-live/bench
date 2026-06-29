import { createHash } from 'node:crypto';
import type { Tenant } from '@bench/types';
import { ProfileRenderer } from '@/components/ProfileRenderer';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { TenantLogo } from '@/components/TenantLogo';
import { getRepository } from '@/lib/data/repository';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getTenantRepository } from '@/lib/data/tenant';

export const dynamic = 'force-dynamic';

/**
 * Client share view with readable URL — `/share/{tenantSlug}/{consultantSlug}/{token}`.
 *
 * The tenant and consultant slugs are cosmetic (for human-readable URLs);
 * the `{token}` is the secret that gates access. We validate via GSI3 lookup
 * just like the original `/share/{token}` route.
 *
 * Validation: active status, unexpired, view scope, active profile.
 * Any failure shows the neutral "no longer available" page.
 */
export default async function ReadableSharePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; consultantSlug: string; token: string }>;
}) {
  const { token } = await params;
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const link = await getMagicLinkRepository().lookupByTokenHash(tokenHash);

  const isValid =
    !!link &&
    link.status === 'active' &&
    link.scope === 'view' &&
    new Date(link.expiresAt).getTime() > Date.now();

  if (!isValid) {
    return <Unavailable tenant={null} />;
  }

  // Resolve tenant for branding
  const tenant = await getTenantRepository().get(link.tenantId);
  const profile = await getRepository().get(link.tenantId, link.profileId);

  if (!profile || profile.status !== 'active') {
    return <Unavailable tenant={tenant} />;
  }

  return (
    <BrandedWrapper tenant={tenant} className="min-h-screen bg-[var(--color-bg-primary)] px-4 py-10 text-[var(--color-text-primary)]">
      <div className="mx-auto max-w-4xl">
        <ProfileRenderer profile={profile} tenant={tenant} />
      </div>
    </BrandedWrapper>
  );
}

function Unavailable({ tenant }: { tenant: Tenant | null }) {
  return (
    <BrandedWrapper tenant={tenant} className="grid min-h-screen place-items-center bg-[var(--color-bg-primary)] px-6 text-center text-[var(--color-text-primary)]">
      <div>
        {tenant ? (
          <div className="mx-auto mb-6">
            <TenantLogo tenant={tenant} size="md" />
          </div>
        ) : (
          <span className="mx-auto mb-6 block text-xl font-bold text-[var(--color-accent)]">Bench</span>
        )}
        <h1 className="text-2xl font-black">This profile is no longer available</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          The link may have expired or been withdrawn.{' '}
          {tenant ? `Please contact ${tenant.name} for an up-to-date profile.` : 'Please contact the sender for assistance.'}
        </p>
      </div>
    </BrandedWrapper>
  );
}
