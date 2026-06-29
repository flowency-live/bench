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
      if (statusFilter.length > 0 && !statusFilter.includes(p.status)) return false;
      if (availabilityFilter.length > 0 && !availabilityFilter.includes(p.availability?.status)) return false;
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
      {/* Toolbar: compact, industrial */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-3">
        <div className="flex flex-wrap gap-2">
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
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-white/15">
            <button
              type="button"
              onClick={() => setView('cards')}
              title="Card view"
              className={`p-1.5 transition ${
                view === 'cards'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              title="List view"
              className={`p-1.5 transition border-l border-white/15 ${
                view === 'list'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full border border-white/15 bg-white/[0.02] px-3 py-1.5 pl-8 text-sm text-white placeholder:text-white/40 outline-none focus:border-[var(--color-accent)] sm:w-48"
            />
            <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
        <span className="font-mono">{visible.length}/{profiles.length}</span>
        <span>showing</span>
        {(statusFilter.length > 0 || availabilityFilter.length > 0 || query) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter([]);
              setAvailabilityFilter([]);
              setQuery('');
            }}
            className="ml-2 text-[var(--color-accent)] hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 text-center text-sm text-[var(--color-text-secondary)]">
          No consultants match your filters.
        </p>
      ) : view === 'cards' ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <ProfileCard key={p.id} profile={p} completion={p.completion} />
          ))}
        </div>
      ) : (
        <div className="mt-4 border border-white/10 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Name</th>
                <th className="hidden px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] sm:table-cell">Role</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Status</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Avail</th>
                <th className="hidden px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] md:table-cell">%</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.map((p) => (
                <tr key={p.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-medium text-white">{p.name}</td>
                  <td className="hidden px-3 py-2 text-[var(--color-text-secondary)] sm:table-cell">
                    {p.role || '-'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-3 py-2">
                    <AvailabilityBadge availability={p.availability} compact />
                  </td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-12 overflow-hidden bg-white/10">
                        <div
                          className="h-full bg-[var(--color-accent)]"
                          style={{ width: `${p.completion.percent}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-[var(--color-text-secondary)]">
                        {p.completion.percent}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/profiles/${p.id}`}
                      className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)] hover:underline"
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
