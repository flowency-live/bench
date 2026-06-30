import Link from 'next/link';
import type { ProfileSummary } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { AvailabilityBadge } from '@/components/AvailabilityBadge';

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return 'now';
  if (days === 1) return '1d';
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface CompletionInfo {
  readonly completed: number;
  readonly total: number;
  readonly percent: number;
}

function CompletionBar({ completion }: { completion: CompletionInfo }) {
  const { completed, total, percent } = completion;
  return (
    <div
      className="flex items-center gap-1.5"
      title={`${percent}% complete (${completed}/${total})`}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Complete
      </span>
      <div className="h-1 w-8 overflow-hidden bg-white/10">
        <div
          className="h-full bg-[var(--color-accent)]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-white/50">{percent}%</span>
    </div>
  );
}

export function ProfileCard({
  profile,
  completion,
}: {
  profile: ProfileSummary;
  completion?: CompletionInfo;
}) {
  return (
    <Link
      href={`/profiles/${profile.id}`}
      className="group flex flex-col border border-white/10 bg-white/[0.02] p-3 transition hover:border-[var(--color-accent)]/50 hover:bg-white/[0.04]"
    >
      {/* Row 1: Avatar + Name + Status */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center bg-[var(--color-bg-primary)] text-[10px] font-bold text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40"
        >
          {initials(profile.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white group-hover:text-[var(--color-accent)]">
            {profile.name}
          </p>
          <p className="truncate text-xs text-[var(--color-text-secondary)]">
            {profile.role ?? 'Role TBC'}
          </p>
        </div>
        <StatusBadge status={profile.status} />
      </div>

      {/* Row 2: Availability + Meta */}
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
        <AvailabilityBadge availability={profile.availability} compact />
        <div className="flex items-center gap-4">
          {completion ? <CompletionBar completion={completion} /> : null}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Updated
            </span>
            <span className="font-mono text-[10px] text-white/50">{timeAgo(profile.updatedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
