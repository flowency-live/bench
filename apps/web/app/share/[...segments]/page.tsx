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
 * Unified client share view supporting both URL patterns:
 *
 * 1. Simple token: `/share/{token}` (segments = [token])
 * 2. Readable URL: `/share/{tenantSlug}/{consultantSlug}/{token}` (segments = [tenantSlug, consultantSlug, token])
 *
 * In both cases, the `{token}` is the secret that gates access. The tenant and
 * consultant slugs in the readable URL are cosmetic (for human-readable links).
 *
 * Uses catch-all `[...segments]` route because Amplify SSR has issues with
 * deeply nested dynamic segments like `[a]/[b]/[c]`.
 *
 * Validation: active status, unexpired, view scope, active profile.
 * Any failure shows the neutral "no longer available" page.
 */
export default async function SharePage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;

  // Extract token from segments:
  // - 1 segment: [token]
  // - 3 segments: [tenantSlug, consultantSlug, token]
  const token =
    segments.length === 1
      ? segments[0]
      : segments.length === 3
        ? segments[2]
        : null;

  if (!token) {
    // Invalid URL structure
    return <Unavailable tenant={null} />;
  }

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
