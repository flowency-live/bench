'use client';

import { useState, useTransition } from 'react';
import { changeStatus, setAvailability } from '@/app/actions';
import type {
  Availability,
  AvailabilityStatus,
  NoticePeriod,
  ProfileStatus,
} from '@/lib/types';
import {
  STATUS_LABELS,
  STATUS_ORDER,
  AVAILABILITY_LABELS,
  NOTICE_PERIOD_LABELS,
  NOTICE_PERIOD_ORDER,
} from '@/lib/types';

const STATUS_STYLES: Record<ProfileStatus, string> = {
  no_profile: 'bg-white/10 text-white/60',
  in_progress: 'bg-amber-400/15 text-amber-300',
  active: 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]',
  removed: 'bg-white/5 text-white/40',
};

const AVAILABILITY_STYLES: Record<AvailabilityStatus, string> = {
  available: 'bg-green-500/15 text-green-400',
  looking: 'bg-amber-400/15 text-amber-300',
  engaged: 'bg-blue-400/15 text-blue-300',
  pitched: 'bg-purple-400/15 text-purple-300',
};

interface Props {
  profileId: string;
  currentStatus: ProfileStatus;
  currentAvailability: Availability;
}

export function StatusControls({ profileId, currentStatus, currentAvailability }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showAvailabilityMenu, setShowAvailabilityMenu] = useState(false);
  const [pendingAvailability, setPendingAvailability] = useState<AvailabilityStatus | null>(null);
  const [noticePeriod, setNoticePeriod] = useState<NoticePeriod>(
    currentAvailability.noticePeriod ?? 'immediate'
  );
  const [endDate, setEndDate] = useState<string>(
    currentAvailability.endDate ?? ''
  );

  const handleStatusChange = (status: ProfileStatus) => {
    setShowStatusMenu(false);
    const formData = new FormData();
    formData.set('profileId', profileId);
    formData.set('status', status);
    startTransition(() => {
      changeStatus(formData);
    });
  };

  const handleAvailabilitySelect = (status: AvailabilityStatus) => {
    setShowAvailabilityMenu(false);
    if (status === 'looking') {
      setPendingAvailability('looking');
    } else if (status === 'engaged') {
      setPendingAvailability('engaged');
    } else {
      // Available or Pitched - immediate save
      startTransition(() => {
        setAvailability(profileId, { status });
      });
    }
  };

  const confirmLooking = () => {
    setPendingAvailability(null);
    startTransition(() => {
      setAvailability(profileId, { status: 'looking', noticePeriod });
    });
  };

  const confirmEngaged = () => {
    setPendingAvailability(null);
    startTransition(() => {
      setAvailability(profileId, { status: 'engaged', endDate: endDate || undefined });
    });
  };

  const cancelPending = () => {
    setPendingAvailability(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Profile Status Control */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowStatusMenu(!showStatusMenu)}
          disabled={isPending}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-white/15 transition hover:ring-white/30 ${STATUS_STYLES[currentStatus]} ${isPending ? 'opacity-50' : ''}`}
        >
          {STATUS_LABELS[currentStatus]}
          <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showStatusMenu && (
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-white/10 bg-[var(--color-bg-panel)] p-1 shadow-xl">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusChange(s)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                  s === currentStatus
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[s]}`} />
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Availability Control */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowAvailabilityMenu(!showAvailabilityMenu)}
          disabled={isPending}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-white/15 transition hover:ring-white/30 ${AVAILABILITY_STYLES[currentAvailability.status]} ${isPending ? 'opacity-50' : ''}`}
        >
          {AVAILABILITY_LABELS[currentAvailability.status]}
          {currentAvailability.status === 'looking' && currentAvailability.noticePeriod && (
            <span className="font-normal normal-case opacity-75">
              {NOTICE_PERIOD_LABELS[currentAvailability.noticePeriod]}
            </span>
          )}
          {currentAvailability.status === 'engaged' && currentAvailability.endDate && (
            <span className="font-normal normal-case opacity-75">
              {new Date(currentAvailability.endDate).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          )}
          <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showAvailabilityMenu && (
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-white/10 bg-[var(--color-bg-panel)] p-1 shadow-xl">
            {(['available', 'looking', 'engaged', 'pitched'] as AvailabilityStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleAvailabilitySelect(s)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                  s === currentAvailability.status
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${AVAILABILITY_STYLES[s]}`} />
                {AVAILABILITY_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Looking - Notice Period Modal */}
      {pendingAvailability === 'looking' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Notice Period</h3>
            <p className="mt-1 text-sm text-white/60">
              How soon can this person start a new engagement?
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {NOTICE_PERIOD_ORDER.map((np) => (
                <button
                  key={np}
                  type="button"
                  onClick={() => setNoticePeriod(np)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    np === noticePeriod
                      ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                      : 'bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {NOTICE_PERIOD_LABELS[np]}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelPending}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white/60 transition hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLooking}
                className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-bold text-[var(--color-bg-primary)] transition hover:brightness-95"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Engaged - End Date Modal */}
      {pendingAvailability === 'engaged' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Engagement End Date</h3>
            <p className="mt-1 text-sm text-white/60">
              When does their current engagement end?
            </p>
            <div className="mt-4">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[var(--color-bg-primary)] px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelPending}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white/60 transition hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEngaged}
                className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-bold text-[var(--color-bg-primary)] transition hover:brightness-95"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside handler */}
      {(showStatusMenu || showAvailabilityMenu) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setShowStatusMenu(false);
            setShowAvailabilityMenu(false);
          }}
        />
      )}
    </div>
  );
}
