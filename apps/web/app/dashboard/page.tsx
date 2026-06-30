import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { DashboardClient } from '@/app/dashboard/DashboardClient';
import { BuilderLinkButton } from '@/app/dashboard/BuilderLinkButton';
import { getRepository } from '@/lib/data/repository';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  const tenantId = getTenantId(session);

  if (!tenantId) {
    redirect('/login');
  }

  const repo = getRepository();
  const allSummaries = await repo.list(tenantId);

  // Filter out removed profiles from default view
  const profiles = allSummaries.filter((p) => p.status !== 'removed');

  const tenant = await getTenantRepository().get(tenantId);

  const active = profiles.filter((p) => p.status === 'active').length;
  const available = profiles.filter(
    (p) => p.availability?.status === 'available' || p.availability?.status === 'looking',
  ).length;

  return (
    <BrandedWrapper tenant={tenant} className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {/* Header: compact industrial layout */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-2 w-2 shrink-0 bg-[var(--color-accent)]" />
            <h1 className="text-base font-bold uppercase tracking-widest text-white sm:text-lg">
              Collective
            </h1>
            <span className="hidden text-sm text-[var(--color-text-secondary)] sm:inline truncate">
              {tenant?.name}
            </span>
          </div>

          {/* Stats: horizontal bar, scrollable on mobile */}
          <div className="flex gap-px overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible scrollbar-none">
            <Stat label="TOTAL" value={profiles.length} />
            <Stat label="ACTIVE" value={active} accent />
            <Stat label="AVAIL" value={available} />
          </div>
        </div>

        {/* Add consultants: manually, or via a reusable self-serve builder link. */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/new"
            className="inline-flex items-center gap-2 border border-[var(--color-accent)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
          >
            <span className="text-base leading-none">+</span>
            <span>Add consultant</span>
          </Link>
          <BuilderLinkButton />
        </div>

        <div className="mt-4">
          {profiles.length === 0 ? (
            <EmptyState />
          ) : (
            <DashboardClient profiles={profiles} />
          )}
        </div>
      </main>
    </BrandedWrapper>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 border-y border-r first:border-l px-3 py-1.5 ${
      accent
        ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5'
        : 'border-white/10 bg-white/[0.02]'
    }`}>
      <span className="font-mono text-base font-bold tabular-nums text-white sm:text-lg">
        {value.toString().padStart(2, '0')}{suffix}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        {label}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-white/20 bg-white/[0.02] p-6 text-center sm:p-10">
      <div className="mx-auto w-fit border border-white/10 bg-white/[0.02] px-4 py-1.5 mb-4">
        <span className="font-mono text-xs tracking-wider text-[var(--color-text-secondary)]">0 PROFILES</span>
      </div>
      <p className="text-sm font-semibold text-white">No consultants in the Collective</p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Add a consultant with name and email. They complete the rest.
      </p>
      <Link
        href="/dashboard/new"
        className="mt-5 inline-flex items-center gap-2 border border-[var(--color-accent)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
      >
        <span className="text-base leading-none">+</span>
        <span>Add consultant</span>
      </Link>
    </div>
  );
}
