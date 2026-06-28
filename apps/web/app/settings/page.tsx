import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { PILOT_TENANT } from '@/lib/tenant';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Account settings — the signed-in owner's identity + password management.
 *
 * Password change today routes through the verified reset flow (email a code →
 * set a new password). An in-app current→new change (no email round-trip) is a
 * WEB fast-follow using `cognito.changePassword`.
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

  const email = session.email;
  const roleLabel = 'Owner / Admin';

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">Account</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Your sign-in details for {PILOT_TENANT.instanceName}.
        </p>

        {/* Identity */}
        <section className="mt-8 rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
          <Field label="Email" value={email} />
          <div className="mt-4 border-t border-white/5 pt-4">
            <Field label="Role" value={roleLabel} />
          </div>
        </section>

        {/* Password */}
        <section className="mt-6 rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
          <h2 className="text-lg font-black">Password</h2>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
            We&rsquo;ll email a verification code to <span className="text-white">{email}</span>,
            then you set a new password. Must be at least 12 characters with upper and lower case,
            a number, and a symbol.
          </p>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block rounded-full border border-[var(--color-accent)] px-5 py-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
          >
            Change password
          </Link>
        </section>
      </main>
    </div>
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
