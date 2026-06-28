import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getUserRepository } from '@/lib/data/user';

export const dynamic = 'force-dynamic';

/**
 * Team — the admins and viewers with access to this tenant's Change Hub
 * (the tenant-facing half of ADR-0010 §user-management). Read-only for now;
 * invite / role-change / remove are admin-only mutations (WEB fast-follow).
 */
export default async function TeamPage() {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) redirect('/login');

  const users = await getUserRepository().listByTenant(tenantId);
  // Only admin and platform sessions have email; member sessions use profileId
  const currentEmail =
    session?.kind === 'admin'
      ? session.email.toLowerCase()
      : session?.kind === 'platform'
        ? session.email.toLowerCase()
        : null;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">Team</h1>
        <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
          People with access to this Change Hub. Admins manage consultants and links; viewers
          have read-only access.
        </p>

        {users.length === 0 ? (
          <p className="mt-8 text-[var(--color-text-secondary)]">No team members yet.</p>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">Name</th>
                  <th className="hidden px-4 py-3 font-semibold text-[var(--color-text-secondary)] sm:table-cell">Email</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">Role</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => {
                  const isYou = u.email.toLowerCase() === currentEmail;
                  return (
                    <tr key={u.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-semibold text-white">
                        {u.name ?? '—'}
                        {isYou && (
                          <span className="ml-2 text-[11px] font-normal text-[var(--color-text-secondary)]">
                            (you)
                          </span>
                        )}
                        <span className="mt-0.5 block text-xs font-normal text-[var(--color-text-secondary)] sm:hidden">
                          {u.email}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-[var(--color-text-secondary)] sm:table-cell">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)] ring-1 ring-white/10">
                          {u.role === 'admin' ? 'Admin' : 'Viewer'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            u.status === 'active'
                              ? 'rounded-full bg-[var(--color-accent)]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent)]'
                              : 'rounded-full bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-300'
                          }
                        >
                          {u.status === 'active' ? 'Active' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
          Inviting team members and changing roles is coming next. The last active admin of a
          tenant cannot be removed.
        </p>
      </main>
    </div>
  );
}
