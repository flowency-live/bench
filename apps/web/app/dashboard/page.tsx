import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { DashboardClient } from '@/app/dashboard/DashboardClient';
import { getRepository } from '@/lib/data/repository';
import { PILOT_TENANT, PILOT_TENANT_ID } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const profiles = await getRepository().list(PILOT_TENANT_ID);
  const published = profiles.filter((p) => p.status === 'published').length;
  const live = profiles.filter(
    (p) => p.status !== 'archived' && p.status !== 'draft',
  ).length;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              The <span className="text-[var(--color-accent)]">Collective</span>
            </h1>
            <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
              {PILOT_TENANT.name}&rsquo;s talent pool — every Change Maker, their
              status, and what they&rsquo;re ready to take on.
            </p>
          </div>
          <div className="flex gap-6">
            <Stat label="In the Collective" value={profiles.length} />
            <Stat label="Active" value={live} />
            <Stat label="Published" value={published} />
          </div>
        </div>

        <div className="mt-8">
          {profiles.length === 0 ? (
            <EmptyState />
          ) : (
            <DashboardClient profiles={profiles} />
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p className="text-3xl font-black text-[var(--color-accent)]">{value}</p>
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
        {label}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-[var(--color-bg-panel)] p-12 text-center">
      <p className="text-lg font-black">No one in the Collective yet</p>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Add a consultant with just their name and email — they complete the rest.
      </p>
      <Link
        href="/dashboard/new"
        className="mt-6 inline-block rounded-full border border-[var(--color-accent)] px-5 py-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
      >
        + Add consultant
      </Link>
    </div>
  );
}
