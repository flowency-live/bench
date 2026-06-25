import type { ProfileStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

const STYLES: Record<ProfileStatus, string> = {
  draft: 'bg-white/10 text-[var(--color-text-secondary)] ring-1 ring-white/15',
  invited: 'bg-[#37aced]/15 text-[#7cc8f5] ring-1 ring-[#37aced]/30',
  in_progress: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30',
  submitted: 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40',
  published: 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] ring-1 ring-[var(--color-accent)]',
  archived: 'bg-white/5 text-white/40 ring-1 ring-white/10',
};

export function StatusBadge({ status }: { status: ProfileStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
