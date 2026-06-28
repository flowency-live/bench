import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { validateToken } from './actions';
import { ClaimForm } from './ClaimForm';

export const dynamic = 'force-dynamic';

/**
 * Claim page — owner sets their password on first sign-in.
 *
 * GET /auth/claim?token=...
 *
 * This page is shown when an owner clicks their onboarding link. They set a
 * password here, which registers them in Cognito. Future logins can use the
 * password or request a new magic link.
 */
export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect('/login?error=invalid');
  }

  const validated = await validateToken(token);

  if (!validated.valid || !validated.email) {
    redirect('/login?error=invalid');
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--color-bg-primary)] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-6 h-9 w-auto" />
          <h1 className="text-2xl font-black text-white">Set your password</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Welcome! Create a password for <strong className="text-white">{validated.email}</strong> to complete your account setup.
          </p>
        </div>

        <ClaimForm token={token} email={validated.email} />

        <p className="mt-6 text-center text-xs text-[var(--color-text-secondary)]">
          By continuing, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
