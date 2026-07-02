import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';

export const dynamic = 'force-dynamic';

/**
 * Account settings — the signed-in owner's identity management.
 *
 * ADR-0014: passwordless auth — no password management section.
 */
export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Platform (godmode) sessions have no tenant password to manage.
  if (session.kind === 'platform') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <h1 className="text-3xl font-black tracking-tight">Account</h1>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            You are signed in as a platform admin (godmode). There is no tenant password to
            manage here. Manage platform access from{' '}
            <Link href="/godmode" className="font-semibold text-[var(--color-accent)] hover:underline">
              godmode
            </Link>
            .
          </p>
        </main>
      </div>
    );
  }

  // Member sessions (consultants) use magic links, not passwords.
  if (session.kind === 'member') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <h1 className="text-3xl font-black tracking-tight">Account</h1>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            You are signed in as a consultant. Your profile is accessed via magic links, so there
            is no password to manage.
          </p>
        </main>
      </div>
    );
  }

  // After the early returns, only admin sessions remain
  if (session.kind !== 'admin') {
    // This should never happen, but satisfies TypeScript
    redirect('/login');
  }

  const tenantId = getTenantId(session);
  if (!tenantId) redirect('/login');

  const tenant = await getTenantRepository().get(tenantId);
  const email = session.email;
  const roleLabel = 'Owner / Admin';

  return (
    <BrandedWrapper tenant={tenant} className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">Account</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Your sign-in details for {tenant?.instanceName ?? 'your portal'}.
        </p>

        {/* Identity */}
        <section className="mt-8 rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
          <Field label="Email" value={email} />
          <div className="mt-4 border-t border-white/5 pt-4">
            <Field label="Role" value={roleLabel} />
          </div>
        </section>

        {/* Security */}
        <section className="mt-6 rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
          <h2 className="text-lg font-black">Security</h2>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
            Manage how you sign in to your account. Link additional methods like phone, Google, or Apple.
          </p>
          <Link
            href="/settings/security"
            className="mt-4 inline-block rounded-full border border-[var(--color-accent)] px-5 py-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
          >
            Manage sign-in methods
          </Link>
        </section>

        {/* Branding */}
        <section className="mt-6 rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
          <h2 className="text-lg font-black">Branding</h2>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
            Customize your portal&rsquo;s appearance with your brand colors and logo.
          </p>
          <Link
            href="/settings/brand"
            className="mt-4 inline-block rounded-full border border-[var(--color-accent)] px-5 py-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
          >
            Customize branding
          </Link>
        </section>
      </main>
    </BrandedWrapper>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}
