import { createHash } from 'node:crypto';
import type { Tenant } from '@bench/types';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getTenantRepository } from '@/lib/data/tenant';
import { TenantLogo } from '@/components/TenantLogo';
import { BrandedWrapper } from '@/components/BrandedWrapper';

export const dynamic = 'force-dynamic';

/** Validate (without consuming) an invite token for display. Returns the tenant if valid. */
async function validateInviteToken(token: string): Promise<Tenant | null> {
  if (!token) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const lookup = await getMagicLinkRepository().lookupByTokenHash(tokenHash);
  if (!lookup) return null;
  if (lookup.status !== 'active') return null;
  if (new Date(lookup.expiresAt).getTime() <= Date.now()) return null;
  if (lookup.type !== 'invite') return null;
  if (lookup.scope !== 'edit') return null;
  // Get the tenant from the lookup
  return getTenantRepository().get(lookup.tenantId);
}

function Shell({ children, tenant }: { children: React.ReactNode; tenant: Tenant | null }) {
  return (
    <BrandedWrapper tenant={tenant} className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-6 py-12 text-[var(--color-text-primary)]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          {tenant ? (
            <TenantLogo tenant={tenant} size="md" />
          ) : (
            <span className="text-xl font-bold text-[var(--color-accent)]">Bench</span>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-[var(--color-bg-panel)] p-8 text-center shadow-lg">
          {children}
        </div>
      </div>
    </BrandedWrapper>
  );
}

/**
 * Public invite claim page (ADR-0013: tenant-branded from token).
 *
 * Validates the token for display; the actual session is established by the
 * POST to `/invite/[token]/claim` (which re-validates and single-uses the link).
 * Invalid / expired / used → neutral "no longer valid" state.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tenant = await validateInviteToken(token);

  if (!tenant) {
    return (
      <Shell tenant={null}>
        <h1 className="mb-2 text-2xl font-black text-white">
          This invite is no longer valid
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          The link may have expired or already been used. Ask your contact to send a fresh invite.
        </p>
      </Shell>
    );
  }

  return (
    <Shell tenant={tenant}>
      <h1 className="mb-2 text-2xl font-black text-white">
        You&rsquo;ve been invited to build your Change Maker profile
      </h1>
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Set out your skills, stories, and impact. It takes just a few minutes,
        and you can save as you go.
      </p>
      <form action={`/invite/${token}/claim`} method="post">
        <button
          type="submit"
          className="w-full rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-black uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-95"
        >
          Start my profile
        </button>
      </form>
      <p className="mt-4 text-xs text-white/40">
        This is a secure, single-use link just for you.
      </p>
    </Shell>
  );
}
