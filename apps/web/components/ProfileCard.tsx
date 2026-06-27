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
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface CompletionInfo {
  readonly completed: number;
  readonly total: number;
  readonly percent: number;
}

/** Compact completion indicator. */
function CompletionBar({ completion }: { completion: CompletionInfo }) {
  const { completed, total, percent } = completion;
  return (
    <div
      className="flex items-center gap-2"
      title={`Profile ${percent}% complete (${completed}/${total} sections)`}
    >
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[var(--color-accent)]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-white/50">{percent}%</span>
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
      className="group flex flex-col rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-4 transition hover:border-[var(--color-accent)]/50 hover:shadow-lg hover:shadow-black/30"
    >
      {/* Row 1: Avatar + Name + Status */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-bg-primary)] text-xs font-black text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40"
        >
          {initials(profile.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-white group-hover:text-[var(--color-accent)]">
            {profile.name}
          </p>
        </div>
        <StatusBadge status={profile.status} />
      </div>

      {/* Row 2: Role */}
      <p className="mt-1 truncate pl-[52px] text-sm text-[var(--color-text-secondary)]">
        {profile.role ?? 'Role to be confirmed'}
      </p>

      {/* Row 3: Availability */}
      <div className="mt-3 pl-[52px]">
        <AvailabilityBadge availability={profile.availability} />
      </div>

      {/* Row 4: Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
        <span className="text-xs text-white/40">{timeAgo(profile.updatedAt)}</span>
        {completion ? <CompletionBar completion={completion} /> : null}
      </div>
    </Link>
  );
}
