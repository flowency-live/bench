import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { getSession, getTenantId } from '@/lib/auth/session';
import { ClientForm } from '@/components/ClientForm';

export const dynamic = 'force-dynamic';

/**
 * Create a new client company.
 */
export default async function NewClientPage() {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) redirect('/login');

  // Only admins and platform can access
  if (session?.kind !== 'admin' && session?.kind !== 'platform') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">Add Client</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Create a new client company who can access the Client Portal.
        </p>

        <div className="mt-8">
          <ClientForm />
        </div>
      </main>
    </div>
  );
}
