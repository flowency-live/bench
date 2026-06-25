import { PILOT_TENANT } from '@/lib/tenant';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

/**
 * Branded admin (owner) sign-in screen — passwordless magic link.
 *
 * Full-screen navy with the Change Connected logo. `?error=invalid` (set by the
 * verify route on a bad/expired link) surfaces an inline notice.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const invalid = error === 'invalid';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-6 py-12 text-[var(--color-text-primary)]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-change-connected.webp"
            alt="Change Connected"
            className="h-9 w-auto"
          />
          <span className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-secondary)]">
            {PILOT_TENANT.instanceName}
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[var(--color-bg-panel)] p-8 shadow-lg">
          <h1 className="mb-1 text-2xl font-black text-white">Admin sign-in</h1>
          <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
            Manage the collective and consultant profiles.
          </p>
          <LoginForm invalid={invalid} />
        </div>
      </div>
    </main>
  );
}
