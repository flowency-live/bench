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

export function ProfileCard({ profile }: { profile: ProfileSummary }) {
  return (
    <Link
      href={`/profiles/${profile.id}`}
      className="group flex flex-col gap-4 rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-5 transition hover:border-[var(--color-accent)]/50 hover:shadow-lg hover:shadow-black/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-black text-white ring-2 ring-white/15"
            style={{ background: 'linear-gradient(135deg, #7ed321, #00bcd4 55%, #2196f3)' }}
          >
            {profile.headshotUrl ? '' : initials(profile.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-black text-white group-hover:text-[var(--color-accent)]">
              {profile.name}
            </p>
            <p className="truncate text-sm text-[var(--color-text-secondary)]">
              {profile.role ?? 'Role to be confirmed'}
            </p>
          </div>
        </div>
        <StatusBadge status={profile.status} />
      </div>
      <p className="text-xs text-white/40">Updated {timeAgo(profile.updatedAt)}</p>
    </Link>
  );
}
