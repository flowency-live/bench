import { createHash } from 'node:crypto';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { PILOT_TENANT } from '@/lib/tenant';
import { Logo } from '@/components/Logo';

export const dynamic = 'force-dynamic';

/** Validate (without consuming) an invite token for display. */
async function isInviteValid(token: string): Promise<boolean> {
  if (!token) return false;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const lookup = await getMagicLinkRepository().lookupByTokenHash(tokenHash);
  if (!lookup) return false;
  if (lookup.status !== 'active') return false;
  if (new Date(lookup.expiresAt).getTime() <= Date.now()) return false;
  if (lookup.type !== 'invite') return false;
  if (lookup.scope !== 'edit') return false;
  return true;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-6 py-12 text-[var(--color-text-primary)]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-9 w-auto" />
          <span className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-secondary)]">
            {PILOT_TENANT.instanceName}
          </span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[var(--color-bg-panel)] p-8 text-center shadow-lg">
          {children}
        </div>
      </div>
    </main>
  );
}

/**
 * Public invite claim page.
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
  const valid = await isInviteValid(token);

  if (!valid) {
    return (
      <Shell>
        <h1 className="mb-2 text-2xl font-black text-white">
          This invite is no longer valid
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          The link may have expired or already been used. Ask your contact at{' '}
          {PILOT_TENANT.name} to send a fresh invite.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mb-2 text-2xl font-black text-white">
        You&rsquo;ve been invited to build your Change Maker profile
      </h1>
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Set out your skills, stories, and impact — it takes just a few minutes,
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
