'use client';

import { useMemo, useState } from 'react';
import { ProfileCard } from '@/components/ProfileCard';
import type { ProfileStatus, ProfileSummary } from '@/lib/types';
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/types';

type Filter = ProfileStatus | 'all';

export function DashboardClient({ profiles }: { profiles: ProfileSummary[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: profiles.length };
    for (const s of STATUS_ORDER) c[s] = 0;
    for (const p of profiles) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [profiles]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.role ?? '').toLowerCase().includes(q)
      );
    });
  }, [profiles, query, filter]);

  const chips: Filter[] = ['all', ...STATUS_ORDER.filter((s) => counts[s] > 0)];

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => {
            const active = filter === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  active
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                    : 'bg-white/5 text-[var(--color-text-secondary)] ring-1 ring-white/10 hover:text-white'
                }`}
              >
                {c === 'all' ? 'All' : STATUS_LABELS[c]}
                <span className={active ? 'ml-1.5 opacity-70' : 'ml-1.5 opacity-50'}>
                  {counts[c]}
                </span>
              </button>
            );
          })}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or role…"
          className="w-full rounded-full border border-white/15 bg-[var(--color-bg-panel)] px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[var(--color-accent)] md:w-72"
        />
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 text-center text-[var(--color-text-secondary)]">
          No consultants match your search.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      )}
    </div>
  );
}
