import type { ProfileStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

const STYLES: Record<ProfileStatus, string> = {
  no_profile: 'bg-white/10 text-[var(--color-text-secondary)] border-white/15',
  draft: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  active: 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] border-[var(--color-accent)]',
  inactive: 'bg-blue-400/15 text-blue-300 border-blue-400/30',
  removed: 'bg-white/5 text-white/40 border-white/10',
};

// Backwards compatibility: map legacy status values to new ones
function normalizeStatus(status: string | null | undefined): ProfileStatus {
  if (!status) return 'no_profile';
  if (status === 'in_progress') return 'draft';
  if (status in STYLES) return status as ProfileStatus;
  return 'no_profile'; // Fallback for unknown statuses
}

export function StatusBadge({ status }: { status: ProfileStatus | string | null | undefined }) {
  const normalized = normalizeStatus(status);
  const style = STYLES[normalized];
  const label = STATUS_LABELS[normalized];

  return (
    <span
      className={`inline-flex shrink-0 items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${style}`}
    >
      {label}
    </span>
  );
}
