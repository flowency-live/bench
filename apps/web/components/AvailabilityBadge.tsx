import type { Availability, AvailabilityStatus } from '@/lib/types';
import { AVAILABILITY_LABELS, NOTICE_PERIOD_LABELS } from '@/lib/types';

const STYLES: Record<AvailabilityStatus, string> = {
  available: 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
  looking: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30',
  engaged: 'bg-blue-400/15 text-blue-300 ring-1 ring-blue-400/30',
  pitched: 'bg-purple-400/15 text-purple-300 ring-1 ring-purple-400/30',
};

function formatEndDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AvailabilityBadge({ availability }: { availability?: Availability }) {
  if (!availability) {
    return null;
  }
  const { status, noticePeriod, endDate } = availability;

  let label = AVAILABILITY_LABELS[status];
  let detail = '';

  if (status === 'looking' && noticePeriod) {
    detail = NOTICE_PERIOD_LABELS[noticePeriod];
  } else if (status === 'engaged' && endDate) {
    detail = formatEndDate(endDate);
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${STYLES[status]}`}
    >
      {label}
      {detail && (
        <span className="font-normal normal-case opacity-75">{detail}</span>
      )}
    </span>
  );
}
