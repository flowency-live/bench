import { redirect } from 'next/navigation';
import { GodmodeHeader } from '@/components/GodmodeHeader';
import { getPlatformSession } from '@/lib/auth/platform';
import { getTenantRepository } from '@/lib/data/tenant';
import { getUserRepository, type TenantUser } from '@/lib/data/user';
import { CreateTenantForm } from './CreateTenantForm';
import { TenantRow } from './TenantRow';

export const dynamic = 'force-dynamic';

/**
 * Godmode dashboard — the platform super-admin control plane (ADR-0010).
 *
 * Requires a platform session (middleware enforces this too; this is defence in
 * depth + the session read we need for the header). Lists every tenant with its
 * status and a "Switch in" action, plus a create-tenant form.
 */
export default async function GodmodePage() {
  const platform = await getPlatformSession();
  if (!platform) {
    redirect('/godmode/login');
  }

  const tenants = await getTenantRepository().list();

  // Pull each tenant's users server-side so the row can render its admins panel
  // without a client fetch.
  const users = getUserRepository();
  const userLists = await Promise.all(
    tenants.map((tenant) => users.listByTenant(tenant.id)),
  );
  const usersByTenant = new Map<string, readonly TenantUser[]>(
    tenants.map((tenant, i) => [tenant.id, userLists[i] ?? []]),
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <GodmodeHeader email={platform.email} />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Platform <span className="text-[var(--color-accent)]">admin</span>
          </h1>
          <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
            Every tenant on the platform. Provision new orgs, invite their first
            admin, and switch into any tenant to manage it.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Tenant list */}
          <section>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
              Tenants ({tenants.length})
            </h2>
            {tenants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-[var(--color-bg-panel)] p-10 text-center">
                <p className="text-lg font-black">No tenants yet</p>
                <p className="mt-2 text-[var(--color-text-secondary)]">
                  Create one with the form to get started.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {tenants.map((tenant) => (
                  <TenantRow
                    key={tenant.id}
                    tenant={tenant}
                    users={usersByTenant.get(tenant.id) ?? []}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Create tenant */}
          <aside>
            <CreateTenantForm />
          </aside>
        </div>
      </main>
    </div>
  );
}
