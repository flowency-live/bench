'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ProfileCard } from '@/components/ProfileCard';
import { AvailabilityBadge } from '@/components/AvailabilityBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { MultiSelectDropdown } from '@/components/MultiSelectDropdown';
import type { AvailabilityStatus, ProfileStatus, ProfileSummary } from '@/lib/types';
import { STATUS_LABELS, STATUS_ORDER, AVAILABILITY_LABELS } from '@/lib/types';

type ViewMode = 'cards' | 'list';

const AVAILABILITY_ORDER: AvailabilityStatus[] = ['available', 'looking', 'engaged', 'pitched'];

/**
 * Dashboard view row: a `ProfileSummary` augmented with a derived completion
 * score. This is a UI-only shape — it intentionally does NOT live in
 * `lib/types.ts` so the shared `ProfileSummary`/`@bench/data` contract stays
 * untouched. The dashboard page builds these rows; this is the single source.
 */
export type DashboardRow = ProfileSummary & {
  readonly completion: {
    readonly completed: number;
    readonly total: number;
    readonly percent: number;
  };
};

export function DashboardClient({ profiles }: { profiles: DashboardRow[] }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProfileStatus[]>([]);
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityStatus[]>([]);
  const [view, setView] = useState<ViewMode>('cards');

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUS_ORDER) counts[s] = 0;
    for (const p of profiles) counts[p.status] = (counts[p.status] ?? 0) + 1;
    return counts;
  }, [profiles]);

  const availabilityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of AVAILABILITY_ORDER) counts[a] = 0;
    for (const p of profiles) {
      const status = p.availability?.status;
      if (status) counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [profiles]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      // Status filter (empty = all)
      if (statusFilter.length > 0 && !statusFilter.includes(p.status)) return false;
      // Availability filter (empty = all)
      if (availabilityFilter.length > 0 && !availabilityFilter.includes(p.availability?.status)) return false;
      // Text search
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.role ?? '').toLowerCase().includes(q)
      );
    });
  }, [profiles, query, statusFilter, availabilityFilter]);

  const statusOptions = STATUS_ORDER.map((s) => ({
    value: s,
    label: STATUS_LABELS[s],
    count: statusCounts[s],
  }));

  const availabilityOptions = AVAILABILITY_ORDER.map((a) => ({
    value: a,
    label: AVAILABILITY_LABELS[a],
    count: availabilityCounts[a],
  }));

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-3">
          <MultiSelectDropdown
            label="Status"
            options={statusOptions}
            selected={statusFilter}
            onChange={(selected) => setStatusFilter(selected as ProfileStatus[])}
          />
          <MultiSelectDropdown
            label="Availability"
            options={availabilityOptions}
            selected={availabilityFilter}
            onChange={(selected) => setAvailabilityFilter(selected as AvailabilityStatus[])}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-white/15 p-0.5">
            <button
              type="button"
              onClick={() => setView('cards')}
              title="Card view"
              className={`rounded-md p-1.5 transition ${
                view === 'cards'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              title="List view"
              className={`rounded-md p-1.5 transition ${
                view === 'list'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or role..."
            className="w-full rounded-full border border-white/15 bg-[var(--color-bg-panel)] px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none focus:border-[var(--color-accent)] md:w-72"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <span>Showing {visible.length} of {profiles.length}</span>
        {(statusFilter.length > 0 || availabilityFilter.length > 0 || query) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter([]);
              setAvailabilityFilter([]);
              setQuery('');
            }}
            className="text-[var(--color-accent)] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 text-center text-[var(--color-text-secondary)]">
          No consultants match your filters.
        </p>
      ) : view === 'cards' ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <ProfileCard key={p.id} profile={p} completion={p.completion} />
          ))}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">Name</th>
                <th className="hidden px-4 py-3 font-semibold text-[var(--color-text-secondary)] sm:table-cell">Role</th>
                <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">Status</th>
                <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">Availability</th>
                <th className="hidden px-4 py-3 font-semibold text-[var(--color-text-secondary)] md:table-cell">Complete</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--color-text-secondary)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.map((p) => (
                <tr key={p.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-semibold text-white">{p.name}</td>
                  <td className="hidden px-4 py-3 text-[var(--color-text-secondary)] sm:table-cell">
                    {p.role || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    <AvailabilityBadge availability={p.availability} />
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[var(--color-accent)]"
                          style={{ width: `${p.completion.percent}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {p.completion.percent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/profiles/${p.id}`}
                      className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
