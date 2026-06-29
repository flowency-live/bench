import type { Availability, AvailabilityStatus } from '@/lib/types';
import { AVAILABILITY_LABELS, NOTICE_PERIOD_LABELS } from '@/lib/types';

const STYLES: Record<AvailabilityStatus, string> = {
  available: 'bg-green-500/15 text-green-400 border-green-500/30',
  looking: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  engaged: 'bg-blue-400/15 text-blue-300 border-blue-400/30',
  pitched: 'bg-purple-400/15 text-purple-300 border-purple-400/30',
};

const SHORT_LABELS: Record<AvailabilityStatus, string> = {
  available: 'AVAIL',
  looking: 'LOOK',
  engaged: 'BUSY',
  pitched: 'PITCH',
};

function formatEndDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function AvailabilityBadge({
  availability,
  compact,
}: {
  availability?: Availability;
  compact?: boolean;
}) {
  if (!availability) {
    return (
      <span className="inline-flex shrink-0 items-center border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap text-white/40">
        {compact ? '---' : 'Not set'}
      </span>
    );
  }
  const { status, noticePeriod, endDate } = availability;

  const label = compact ? SHORT_LABELS[status] : AVAILABILITY_LABELS[status];
  let detail = '';

  if (!compact) {
    if (status === 'looking' && noticePeriod) {
      detail = NOTICE_PERIOD_LABELS[noticePeriod];
    } else if (status === 'engaged' && endDate) {
      detail = formatEndDate(endDate);
    }
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${STYLES[status]}`}
    >
      {label}
      {detail && (
        <span className="font-normal normal-case opacity-75">{detail}</span>
      )}
    </span>
  );
}
