import { PILOT_TENANT } from '@/lib/tenant';
import { LoginForm } from './LoginForm';
import { Logo } from '@/components/Logo';
import { getPendingInvite } from '@/lib/auth/pending-invite';

export const dynamic = 'force-dynamic';

/**
 * Branded admin (owner) sign-in screen — passwordless magic link.
 *
 * Full-screen navy with the Change Connected logo. `?error=invalid` (set by the
 * verify route on a bad/expired link) surfaces an inline notice.
 *
 * When `?pending=admin` is present (user clicked an invite link), shows
 * "Complete your setup" and requires identity verification before granting
 * access (ADR-0014: invite ≠ authentication).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; pending?: string }>;
}) {
  const { error, pending } = await searchParams;
  const invalid = error === 'invalid';

  // Check for pending invite in cookie (set by /auth/verify when clicking invite link)
  const pendingInvite = pending ? await getPendingInvite() : null;
  const isPendingSetup = pending === 'admin' && pendingInvite !== null;

  return (
    <main className="login-page relative min-h-screen flex items-center justify-center px-6 py-12 overflow-hidden">
      {/* Subtle radial gradient overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(186, 235, 91, 0.03) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[460px] flex flex-col items-center">
        {/* Logo & Branding */}
        <header className="flex flex-col items-center mb-10 text-center">
          <Logo className="h-auto w-auto max-w-[280px] drop-shadow-lg" />
          <span className="mt-4 text-[11px] font-semibold tracking-[0.25em] uppercase text-[#94a3b8]">
            {PILOT_TENANT.instanceName}
          </span>
        </header>

        {/* Sign-in Card */}
        <div className="login-card relative w-full rounded-[20px] p-px">
          {/* Top glow accent */}
          <div
            className="absolute -top-px left-1/2 -translate-x-1/2 w-[60%] h-[2px] rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(186, 235, 91, 0.5) 50%, transparent 100%)',
            }}
            aria-hidden="true"
          />
          <div className="login-card__inner rounded-[20px] p-8 sm:p-10">
            <h1 className="mb-1 text-[1.75rem] font-black text-white tracking-tight">
              {isPendingSetup ? 'Complete your setup' : 'Admin sign-in'}
            </h1>
            <p className="mb-8 text-[15px] text-[#cbd5e1] leading-relaxed">
              {isPendingSetup
                ? 'Verify your identity to activate your admin account.'
                : 'Manage the collective and consultant profiles.'}
            </p>
            <LoginForm
              invalid={invalid}
              pendingEmail={pendingInvite?.email}
            />
          </div>
        </div>

        {/* Footer tagline */}
        <p className="mt-8 text-[13px] text-[#94a3b8] text-center font-medium">
          Drop us a line! Connecting is what we do.
        </p>
      </div>
    </main>
  );
}
