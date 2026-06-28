import { createHash } from 'node:crypto';
import { ProfileRenderer } from '@/components/ProfileRenderer';
import { getRepository } from '@/lib/data/repository';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { Logo } from '@/components/Logo';

export const dynamic = 'force-dynamic';

/**
 * Client share view — read-only, no portal chrome, reads as an extension of the
 * tenant's site.
 *
 * The `[token]` segment is the raw secret from the share link. We re-hash it
 * (SHA-256) and resolve it via GSI3 (`lookupByTokenHash`, ADR-0008) to recover
 * tenant context, then validate the link is live (active, unexpired, view scope)
 * and the underlying profile is active (ADR-0011 two-axis). Any failure — bad
 * token, expired, revoked, wrong scope, or inactive profile — falls through to the neutral
 * `Unavailable` page so we never leak why.
 */
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
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
    return <Unavailable />;
  }

  const profile = await getRepository().get(link.tenantId, link.profileId);

  if (!profile || profile.status !== 'active') {
    return <Unavailable />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] px-4 py-10 text-[var(--color-text-primary)]">
      <div className="mx-auto max-w-4xl">
        <ProfileRenderer profile={profile} />
      </div>
    </div>
  );
}

function Unavailable() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--color-bg-primary)] px-6 text-center text-[var(--color-text-primary)]">
      <div>
        <Logo className="mx-auto mb-6 h-9 w-auto" />
        <h1 className="text-2xl font-black">This profile is no longer available</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          The link may have expired or been withdrawn. Please contact Change Connected
          for an up-to-date profile.
        </p>
      </div>
    </div>
  );
}
