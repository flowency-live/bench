import { createHash } from 'node:crypto';
import type { Tenant } from '@bench/types';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getTenantRepository } from '@/lib/data/tenant';
import { TenantLogo } from '@/components/TenantLogo';
import { BrandedWrapper } from '@/components/BrandedWrapper';

export const dynamic = 'force-dynamic';

/** Sentinel profileId under which a tenant's reusable builder link is stored. */
const BUILDER_PROFILE_ID = 'BUILDER';

/** Validate (without consuming) a reusable builder token. Returns the tenant if valid. */
async function validateBuilderToken(token: string): Promise<Tenant | null> {
  if (!token) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const lookup = await getMagicLinkRepository().lookupByTokenHash(tokenHash);
  if (!lookup) return null;
  if (lookup.status !== 'active') return null;
  if (new Date(lookup.expiresAt).getTime() <= Date.now()) return null;
  if (lookup.type !== 'invite') return null;
  if (lookup.scope !== 'edit') return null;
  if (lookup.profileId !== BUILDER_PROFILE_ID) return null;
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
        <div className="rounded-2xl border border-white/10 bg-[var(--color-bg-panel)] p-8 shadow-lg">
          {children}
        </div>
      </div>
    </BrandedWrapper>
  );
}

/**
 * Public builder entry — a reusable, record-less link a tenant admin shares with
 * anyone they want to add. We collect just a name + email to create the record,
 * then `/build/[token]/start` (POST) seeds a member session and opens the wizard.
 * Invalid / expired link → neutral "no longer valid" state.
 */
export default async function BuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const tenant = await validateBuilderToken(token);

  if (!tenant) {
    return (
      <Shell tenant={null}>
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-black text-white">This link is no longer valid</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            It may have expired. Ask your contact for a fresh link.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell tenant={tenant}>
      <h1 className="mb-2 text-2xl font-black text-white">
        Build your {tenant.instanceName} profile
      </h1>
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Tell us who you are to get started. You can save as you go and update it any time.
      </p>

      {error === 'details' && (
        <p className="mb-4 rounded-lg border border-red-500/20 bg-red-600/[0.08] px-4 py-3 text-sm text-red-300">
          Please enter your full name and a valid email address.
        </p>
      )}

      <form action={`/build/${token}/start`} method="post" className="flex flex-col gap-4">
        <div className="flex flex-col">
          <label htmlFor="name" className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Priya Nair"
            className="rounded-lg border border-white/15 bg-[var(--color-bg-primary)] px-4 py-2.5 text-white outline-none placeholder:text-white/30 focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="email" className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="rounded-lg border border-white/15 bg-[var(--color-bg-primary)] px-4 py-2.5 text-white outline-none placeholder:text-white/30 focus:border-[var(--color-accent)]"
          />
        </div>
        <button
          type="submit"
          className="mt-1 w-full rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-black uppercase tracking-wide text-[var(--color-accent-foreground)] transition hover:brightness-95"
        >
          Start my profile
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-white/40">
        Your profile is created for {tenant.name} and managed by their team.
      </p>
    </Shell>
  );
}
