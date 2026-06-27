import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { getPlatformSession } from '@/lib/auth/platform';
import { getTenantRepository, type Tenant } from '@/lib/data/tenant';
import { CreateTenantForm } from './CreateTenantForm';
import { switchTenant } from './actions';

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

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[var(--color-bg-primary)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Logo className="h-7 w-auto" />
            <span className="border-l border-white/15 pl-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
              Godmode
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-[var(--color-text-secondary)] sm:inline">
              {platform.email}
            </span>
            <a
              href="/auth/logout"
              className="text-sm font-semibold text-white/60 transition hover:text-[var(--color-accent)]"
            >
              Sign out
            </a>
          </div>
        </div>
      </header>

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
                  <TenantRow key={tenant.id} tenant={tenant} />
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

function TenantRow({ tenant }: { tenant: Tenant }) {
  const suspended = tenant.status === 'suspended';
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[var(--color-bg-panel)] px-5 py-4">
      <div className="min-w-0">
        <p className="truncate text-base font-black text-white">{tenant.name}</p>
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
          {tenant.instanceName} · {tenant.id}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <span
          className={
            suspended
              ? 'rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-red-300'
              : 'rounded-full bg-[rgba(186,235,91,0.12)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent)]'
          }
        >
          {tenant.status}
        </span>
        <form action={switchTenant}>
          <input type="hidden" name="tenantId" value={tenant.id} />
          <button
            type="submit"
            className="rounded-full border border-[var(--color-accent)] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
          >
            Switch in →
          </button>
        </form>
      </div>
    </li>
  );
}
