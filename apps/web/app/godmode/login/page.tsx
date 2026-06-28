import { LoginForm } from './LoginForm';
import { FlowencyLogo } from '@/components/FlowencyLogo';

export const dynamic = 'force-dynamic';

/**
 * Godmode (platform super-admin) sign-in — the FLOWENCY control plane.
 *
 * Flowency-branded (not the tenant): the Flowency wordmark, deep charcoal-navy,
 * terracotta accents, Plus Jakarta Sans (all from the godmode layout theme).
 * Google sign-in (allowlisted @flowency.co.uk) is primary; magic link is the
 * fallback. `?error=invalid` surfaces an inline notice.
 */
export default async function GodmodeLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const invalid = error === 'invalid';

  return (
    <main className="relative min-h-screen flex items-center justify-center px-6 py-12 overflow-hidden">
      {/* Terracotta flow glow for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(194, 114, 78, 0.10) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[460px] flex flex-col items-center">
        {/* Flowency branding */}
        <header className="flex flex-col items-center mb-10 text-center">
          <FlowencyLogo className="h-9 w-auto" />
          <span className="mt-4 text-[11px] font-semibold tracking-[0.25em] uppercase text-[var(--fl-muted)]">
            Platform admin
          </span>
        </header>

        {/* Sign-in card */}
        <div className="flow-card relative w-full rounded-[12px] p-8 sm:p-10">
          {/* Top terracotta accent */}
          <div
            className="absolute -top-px left-1/2 -translate-x-1/2 w-[55%] h-[2px] rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(194, 114, 78, 0.7) 50%, transparent 100%)',
            }}
            aria-hidden="true"
          />
          <h1 className="mb-1 text-[1.75rem] font-extrabold text-[var(--fl-text)] tracking-tight">
            Godmode
          </h1>
          <p className="mb-8 text-[15px] text-[var(--fl-muted)] leading-relaxed">
            Provision and manage every tenant on the platform.
          </p>
          <LoginForm invalid={invalid} />
        </div>

        {/* Footer tagline */}
        <p className="mt-8 text-[13px] text-[var(--fl-muted)] text-center font-medium">
          Flowency control plane.
        </p>
      </div>
    </main>
  );
}
