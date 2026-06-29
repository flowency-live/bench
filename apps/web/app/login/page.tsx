import { LoginForm } from './LoginForm';
import { BenchMark } from '@/components/BenchMark';
import { getPendingInvite } from '@/lib/auth/pending-invite';

export const dynamic = 'force-dynamic';

/**
 * Generic, pre-auth sign-in screen — the PLATFORM brand, not a tenant's.
 *
 * Standard white-label practice (ADR-0013): before we know who someone is, they
 * see Bench (the OpStack-family platform brand) — never Change Connected or any
 * other tenant. The full tenant skin is only applied AFTER authentication
 * (dashboard onward). Passwordless / invite-only sign-in (ADR-0014).
 *
 * `?error=invalid` (set by the verify route on a bad/expired link) surfaces an
 * inline notice. `?pending=admin` (user clicked an invite link) shows "Complete
 * your setup" and requires identity verification before access (invite is not
 * authentication).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; pending?: string }>;
}) {
  const { error, pending } = await searchParams;
  const invalid = error === 'invalid';

  // Check for a pending invite in the cookie (set by /auth/verify on an invite link).
  const pendingInvite = pending ? await getPendingInvite() : null;
  const isPendingSetup = pending === 'admin' && pendingInvite !== null;

  return (
    <main className="bench-landing relative min-h-screen flex items-center justify-center px-6 py-12 overflow-hidden">
      {/* Subtle purple glow for depth (platform accent). */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(94, 68, 228, 0.12) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[460px] flex flex-col items-center">
        {/* Platform wordmark */}
        <header className="flex flex-col items-center mb-10 text-center">
          <BenchMark className="scale-110" />
          <span className="mt-4 text-[11px] font-semibold tracking-[0.25em] uppercase text-[var(--b-muted)]">
            Invite-only access
          </span>
        </header>

        {/* Sign-in card */}
        <div className="login-card relative w-full rounded-[20px] p-px">
          {/* Top glow accent */}
          <div
            className="absolute -top-px left-1/2 -translate-x-1/2 w-[60%] h-[2px] rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(133, 112, 235, 0.6) 50%, transparent 100%)',
            }}
            aria-hidden="true"
          />
          <div className="login-card__inner rounded-[20px] p-8 sm:p-10">
            <h1 className="mb-1 text-[1.75rem] font-black text-white tracking-tight">
              {isPendingSetup ? 'Complete your setup' : 'Sign in to Bench'}
            </h1>
            <p className="mb-8 text-[15px] text-[#cbd5e1] leading-relaxed">
              {isPendingSetup
                ? 'Verify your identity to activate your account.'
                : 'Sign in to manage your consultancy and consultant profiles.'}
            </p>
            <LoginForm invalid={invalid} pendingEmail={pendingInvite?.email} />
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-[13px] text-[var(--b-muted)] text-center font-medium">
          Bench is an OpStack product. Access is invite-only.
        </p>
      </div>
    </main>
  );
}
