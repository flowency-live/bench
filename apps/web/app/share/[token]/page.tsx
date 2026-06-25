import { ProfileRenderer } from '@/components/ProfileRenderer';
import { getRepository } from '@/lib/data/repository';
import { PILOT_TENANT_ID } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * Client share view — read-only, no portal chrome, reads as an extension of the
 * tenant's site.
 *
 * NOTE: `[token]` is treated as the profile id for this dev slice. In production
 * the token resolves to a profile via the magic-link GSI3 lookup (ADR-0005/0008),
 * honouring expiry/revoke; an invalid/expired token shows the neutral page below.
 */
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const profile = await getRepository().get(PILOT_TENANT_ID, token);

  if (!profile || profile.status !== 'published') {
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
        <p
          aria-hidden
          className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-md font-black text-[var(--color-bg-primary)]"
          style={{ background: 'linear-gradient(135deg, #7ed321, #00bcd4 55%, #2196f3)' }}
        >
          CC
        </p>
        <h1 className="text-2xl font-black">This profile is no longer available</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          The link may have expired or been withdrawn. Please contact Change Connected
          for an up-to-date profile.
        </p>
      </div>
    </div>
  );
}
