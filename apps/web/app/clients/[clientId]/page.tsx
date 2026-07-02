import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { getSession, getTenantId } from '@/lib/auth/session';
import {
  getClientRepository,
  getClientContactRepository,
  getClientActivityRepository,
} from '@/lib/data/client';
import { ClientContactsSection } from '@/components/ClientContactsSection';
import { ClientActivitySection } from '@/components/ClientActivitySection';
import { ClientSettingsSection } from '@/components/ClientSettingsSection';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ clientId: string }>;
}

/**
 * Client detail page — manage contacts, view activity, configure visibility.
 */
export default async function ClientDetailPage({ params }: Props) {
  const { clientId } = await params;
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) redirect('/login');

  // Only admins and platform can access
  if (session?.kind !== 'admin' && session?.kind !== 'platform') {
    redirect('/dashboard');
  }

  const client = await getClientRepository().get(tenantId, clientId);
  if (!client) notFound();

  const contacts = await getClientContactRepository().listByClient(tenantId, clientId);
  const activity = await getClientActivityRepository().listByClient(tenantId, clientId, {
    limit: 20,
  });

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link
              href="/clients"
              className="text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-white"
            >
              &larr; Back to Clients
            </Link>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{client.companyName}</h1>
            <p className="mt-1 text-[var(--color-text-secondary)]">
              Created{' '}
              {new Date(client.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Contacts Section */}
        <section className="mt-10">
          <ClientContactsSection clientId={clientId} contacts={contacts} />
        </section>

        {/* Activity Section */}
        <section className="mt-10">
          <ClientActivitySection activity={activity} />
        </section>

        {/* Settings Section */}
        <section className="mt-10">
          <ClientSettingsSection client={client} />
        </section>
      </main>
    </div>
  );
}
