import Link from 'next/link';
import type { ProfileSummary } from '@/lib/types';
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

/**
 * Profile card for the client portal.
 *
 * Similar to ProfileCard but:
 * - Links to /portal/profile/[id]
 * - No status badge (portal only shows active profiles)
 */
export function PortalProfileCard({ profile }: { profile: ProfileSummary }) {
  return (
    <Link
      href={`/portal/profile/${profile.id}`}
      className="group flex flex-col border border-white/10 bg-white/[0.02] p-3 transition hover:border-[var(--color-accent)]/50 hover:bg-white/[0.04]"
    >
      {/* Row 1: Avatar + Name */}
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
            {profile.role ?? 'Consultant'}
          </p>
        </div>
      </div>

      {/* Row 2: Availability */}
      <div className="mt-3 flex items-center border-t border-white/5 pt-2">
        <AvailabilityBadge availability={profile.availability} compact />
      </div>
    </Link>
  );
}
