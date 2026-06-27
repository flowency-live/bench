import Link from 'next/link';
import type { ProfileSummary } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';

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

/** Compact lime completion ring with percent + "{completed}/{total}". */
function CompletionRing({ completion }: { completion: CompletionInfo }) {
  const { completed, total, percent } = completion;
  // 16px radius, 2.5px stroke → circumference for the dash offset.
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div
      className="flex items-center gap-2"
      title={`Profile ${percent}% complete (${completed}/${total} sections)`}
    >
      <span
        className="relative grid h-10 w-10 shrink-0 place-items-center"
        aria-hidden
      >
        <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="2.5"
          />
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute text-[0.6rem] font-black text-[var(--color-accent)]">
          {percent}%
        </span>
      </span>
      <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
        {completed}/{total} complete
      </span>
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
      className="group flex flex-col gap-4 rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-5 transition hover:border-[var(--color-accent)]/50 hover:shadow-lg hover:shadow-black/30"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-bg-primary)] text-sm font-black text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40"
        >
          {initials(profile.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-black text-white group-hover:text-[var(--color-accent)]">
              {profile.name}
            </p>
            <StatusBadge status={profile.status} />
          </div>
          <p className="truncate text-sm text-[var(--color-text-secondary)]">
            {profile.role ?? 'Role to be confirmed'}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-white/40">Updated {timeAgo(profile.updatedAt)}</p>
        {completion ? <CompletionRing completion={completion} /> : null}
      </div>
    </Link>
  );
}
