import { redirect } from 'next/navigation';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { TenantLogo } from '@/components/TenantLogo';
import { getTenantRepository } from '@/lib/data/tenant';
import { validateToken } from './actions';
import { ClaimForm } from './ClaimForm';

export const dynamic = 'force-dynamic';

/**
 * Claim page — owner sets their password on first sign-in (ADR-0013: tenant-branded).
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

  if (!validated.valid || !validated.email || !validated.tenantId) {
    redirect('/login?error=invalid');
  }

  // Resolve tenant for branding
  const tenant = await getTenantRepository().get(validated.tenantId);

  return (
    <BrandedWrapper tenant={tenant} className="grid min-h-screen place-items-center bg-[var(--color-bg-primary)] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {tenant ? (
            <div className="mx-auto mb-6">
              <TenantLogo tenant={tenant} size="md" />
            </div>
          ) : (
            <span className="mx-auto mb-6 block text-xl font-bold text-[var(--color-text-primary)]">Bench</span>
          )}
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
    </BrandedWrapper>
  );
}
