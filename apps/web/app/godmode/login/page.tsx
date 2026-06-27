import { LoginForm } from './LoginForm';
import { Logo } from '@/components/Logo';

export const dynamic = 'force-dynamic';

/**
 * Branded godmode (platform super-admin) sign-in screen — passwordless magic
 * link to an allowlisted Flowency address (ADR-0010 §Decisions(2)).
 *
 * Full-screen navy with the Change Connected logo, mirroring the admin login.
 * `?error=invalid` (set by the verify route on a bad/expired link) surfaces an
 * inline notice.
 */
export default async function GodmodeLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const invalid = error === 'invalid';

  return (
    <main className="login-page relative min-h-screen flex items-center justify-center px-6 py-12 overflow-hidden">
      {/* Subtle radial gradient overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(186, 235, 91, 0.03) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[460px] flex flex-col items-center">
        {/* Logo & Branding */}
        <header className="flex flex-col items-center mb-10 text-center">
          <Logo className="h-auto w-auto max-w-[280px] drop-shadow-lg" />
          <span className="mt-4 text-[11px] font-semibold tracking-[0.25em] uppercase text-[#94a3b8]">
            Platform admin
          </span>
        </header>

        {/* Sign-in Card */}
        <div className="login-card relative w-full rounded-[20px] p-px">
          {/* Top glow accent */}
          <div
            className="absolute -top-px left-1/2 -translate-x-1/2 w-[60%] h-[2px] rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(186, 235, 91, 0.5) 50%, transparent 100%)',
            }}
            aria-hidden="true"
          />
          <div className="login-card__inner rounded-[20px] p-8 sm:p-10">
            <h1 className="mb-1 text-[1.75rem] font-black text-white tracking-tight">
              Godmode
            </h1>
            <p className="mb-8 text-[15px] text-[#cbd5e1] leading-relaxed">
              Provision and manage every tenant on the platform.
            </p>
            <LoginForm invalid={invalid} />
          </div>
        </div>

        {/* Footer tagline */}
        <p className="mt-8 text-[13px] text-[#94a3b8] text-center font-medium">
          Flowency control plane.
        </p>
      </div>
    </main>
  );
}
