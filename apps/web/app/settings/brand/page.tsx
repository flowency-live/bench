import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';
import { BrandSettingsForm } from './BrandSettingsForm';

export const dynamic = 'force-dynamic';

/**
 * Brand settings page — customize portal appearance (ADR-0013).
 *
 * Allows tenant admins to update:
 * - Instance name (displayed in header)
 * - Brand colors (with WCAG AA contrast validation)
 */
export default async function BrandSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Only admin sessions can manage branding
  if (session.kind !== 'admin') {
    redirect('/settings');
  }

  const tenantId = getTenantId(session);
  if (!tenantId) redirect('/login');

  const tenant = await getTenantRepository().get(tenantId);
  if (!tenant) redirect('/login');

  return (
    <BrandedWrapper tenant={tenant} className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/settings"
            className="text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-accent)]"
          >
            ← Account
          </Link>
        </div>

        <h1 className="text-3xl font-black tracking-tight">Branding</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Customize how your portal looks to consultants and clients.
        </p>

        <div className="mt-8">
          <BrandSettingsForm
            instanceName={tenant.instanceName}
            brandTokens={tenant.brandTokens}
          />
        </div>
      </main>
    </BrandedWrapper>
  );
}
