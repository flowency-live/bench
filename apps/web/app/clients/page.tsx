import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getClientRepository } from '@/lib/data/client';

export const dynamic = 'force-dynamic';

/**
 * Clients — external companies who can access the portal to view consultants.
 * Admin-only page for managing client companies and their contacts.
 */
export default async function ClientsPage() {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) redirect('/login');

  // Only admins and platform can access
  if (session?.kind !== 'admin' && session?.kind !== 'platform') {
    redirect('/dashboard');
  }

  const clients = await getClientRepository().listByTenant(tenantId);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Clients</h1>
            <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
              External companies who can access the Client Portal to browse your consultants.
            </p>
          </div>
          <Link
            href="/clients/new"
            className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-110"
          >
            + Add client
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="mt-12 rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-[var(--color-text-secondary)]">No clients yet.</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Add your first client to give them access to browse your consultants.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">
                    Company
                  </th>
                  <th className="hidden px-4 py-3 font-semibold text-[var(--color-text-secondary)] sm:table-cell">
                    Visibility
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">
                    Created
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {clients.map((client) => (
                  <tr key={client.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-white">{client.companyName}</span>
                      <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)] sm:hidden">
                        {client.visibilityMode === 'all_active'
                          ? 'All active consultants'
                          : `${client.handpickedProfileIds.length} selected`}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--color-text-secondary)] sm:table-cell">
                      {client.visibilityMode === 'all_active' ? (
                        <span className="rounded-full bg-[var(--color-accent)]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent)]">
                          All active
                        </span>
                      ) : (
                        <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)] ring-1 ring-white/10">
                          {client.handpickedProfileIds.length} selected
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {new Date(client.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/clients/${client.id}`}
                        className="text-sm font-semibold text-[var(--color-accent)] transition hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
