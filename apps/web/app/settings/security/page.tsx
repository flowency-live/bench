import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';
import { getUserRepository } from '@/lib/data/user';
import { SecuritySettingsForm } from './SecuritySettingsForm';

export const dynamic = 'force-dynamic';

/**
 * Security settings page — manage account sign-in methods.
 *
 * Allows tenant admins to:
 * - View linked sign-in methods (email always linked)
 * - Link additional methods: Phone, Google, Apple
 * - Unlink methods (must keep at least one)
 */
export default async function SecuritySettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Only admin sessions can manage security settings
  if (session.kind !== 'admin') {
    redirect('/settings');
  }

  const tenantId = getTenantId(session);
  if (!tenantId) redirect('/login');

  const tenant = await getTenantRepository().get(tenantId);
  if (!tenant) redirect('/login');

  // Get the current user's data to show linked methods
  const users = getUserRepository();
  const user = await users.getByEmail(session.email);
  if (!user) redirect('/login');

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

        <h1 className="text-3xl font-black tracking-tight">Security</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Manage the ways you can sign in to your account.
        </p>

        <div className="mt-8">
          <SecuritySettingsForm
            email={user.email}
            phone={user.phone ?? null}
            googleId={user.googleId ?? null}
            appleId={user.appleId ?? null}
            phoneLinkedAt={user.phoneLinkedAt ?? null}
            googleLinkedAt={user.googleLinkedAt ?? null}
            appleLinkedAt={user.appleLinkedAt ?? null}
          />
        </div>
      </main>
    </BrandedWrapper>
  );
}
