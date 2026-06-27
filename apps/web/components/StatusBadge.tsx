import type { ProfileStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

const STYLES: Record<ProfileStatus, string> = {
  no_profile: 'bg-white/10 text-[var(--color-text-secondary)] ring-1 ring-white/15',
  in_progress: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30',
  active: 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] ring-1 ring-[var(--color-accent)]',
  removed: 'bg-white/5 text-white/40 ring-1 ring-white/10',
};

export function StatusBadge({ status }: { status: ProfileStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
