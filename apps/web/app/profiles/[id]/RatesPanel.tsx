'use client';

import { useState, useTransition } from 'react';
import { updateRates, type RatesActionState } from './rates-actions';
import type { RatesAndPreferences, EmploymentType, IR35Status } from '@/lib/types';

interface RatesPanelProps {
  profileId: string;
  rates: RatesAndPreferences | null;
}

const field =
  'w-full rounded-lg border border-white/15 bg-[var(--color-bg-primary)] px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-[var(--color-accent)]';
const label =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]';

function formatPounds(pence: number | null): string {
  if (pence === null) return '';
  return Math.round(pence / 100).toLocaleString('en-GB');
}

function parsePounds(value: string): number | null {
  const cleaned = value.replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  return parseInt(cleaned, 10) * 100;
}

export function RatesPanel({ profileId, rates }: RatesPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [dayRate, setDayRate] = useState(rates?.minDayRatePence ? formatPounds(rates.minDayRatePence) : '');
  const [salary, setSalary] = useState(rates?.salaryPence ? formatPounds(rates.salaryPence) : '');
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>(
    rates?.employmentTypes ? [...rates.employmentTypes] : [],
  );
  const [ir35Statuses, setIr35Statuses] = useState<IR35Status[]>(
    rates?.ir35Statuses ? [...rates.ir35Statuses] : [],
  );
  const [hasLtdCo, setHasLtdCo] = useState(rates?.hasLtdCo ?? false);

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const newRates: RatesAndPreferences = {
        minDayRatePence: parsePounds(dayRate),
        salaryPence: parsePounds(salary),
        employmentTypes,
        ir35Statuses,
        hasLtdCo,
        location: rates?.location ?? null,
      };
      const result: RatesActionState = await updateRates(profileId, newRates);
      if (result.success) {
        setIsEditing(false);
      } else {
        setError(result.error ?? 'Failed to save');
      }
    });
  };

  const handleCancel = () => {
    // Reset form to original values
    setDayRate(rates?.minDayRatePence ? formatPounds(rates.minDayRatePence) : '');
    setSalary(rates?.salaryPence ? formatPounds(rates.salaryPence) : '');
    setEmploymentTypes(rates?.employmentTypes ? [...rates.employmentTypes] : []);
    setIr35Statuses(rates?.ir35Statuses ? [...rates.ir35Statuses] : []);
    setHasLtdCo(rates?.hasLtdCo ?? false);
    setIsEditing(false);
    setError(null);
  };

  const toggleEmploymentType = (type: EmploymentType) => {
    setEmploymentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const toggleIr35Status = (status: IR35Status) => {
    setIr35Statuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  };

  if (isEditing) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Rates & Preferences</h3>
          <span className="text-xs text-white/40">Admin only</span>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-400">{error}</p>
        )}

        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="dayRate">Day rate</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/50">
                £
              </span>
              <input
                id="dayRate"
                type="text"
                className={`${field} pl-8`}
                value={dayRate}
                onChange={(e) => setDayRate(e.target.value)}
                placeholder="750"
              />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="salary">Target salary</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/50">
                £
              </span>
              <input
                id="salary"
                type="text"
                className={`${field} pl-8`}
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="95,000"
              />
            </div>
          </div>

          <div>
            <span className={label}>Employment types</span>
            <div className="flex gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={employmentTypes.includes('contract')}
                  onChange={() => toggleEmploymentType('contract')}
                  className="rounded border-white/20 bg-transparent"
                />
                Contract
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={employmentTypes.includes('permanent')}
                  onChange={() => toggleEmploymentType('permanent')}
                  className="rounded border-white/20 bg-transparent"
                />
                Permanent
              </label>
            </div>
          </div>

          {employmentTypes.includes('contract') && (
            <div>
              <span className={label}>IR35 preference</span>
              <div className="flex gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={ir35Statuses.includes('inside')}
                    onChange={() => toggleIr35Status('inside')}
                    className="rounded border-white/20 bg-transparent"
                  />
                  Inside IR35
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={ir35Statuses.includes('outside')}
                    onChange={() => toggleIr35Status('outside')}
                    className="rounded border-white/20 bg-transparent"
                  />
                  Outside IR35
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={hasLtdCo}
                onChange={(e) => setHasLtdCo(e.target.checked)}
                className="rounded border-white/20 bg-transparent"
              />
              Has Ltd Co
            </label>
          </div>

          {rates?.location && (
            <div>
              <span className={label}>Location</span>
              <p className="text-sm text-white">{rates.location.displayName}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold text-white/70 transition hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-sm font-black uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-95 disabled:opacity-50"
          >
            {pending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-black text-white">Rates & Preferences</h3>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          Edit
        </button>
      </div>

      {!rates ? (
        <p className="text-sm text-white/40">No rates configured</p>
      ) : (
        <div className="space-y-3">
          {rates.minDayRatePence !== null && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-white/60">Day rate</span>
              <span className="text-lg font-semibold text-white">
                £{formatPounds(rates.minDayRatePence)}
              </span>
            </div>
          )}

          {rates.salaryPence !== null && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-white/60">Target salary</span>
              <span className="text-lg font-semibold text-white">
                £{formatPounds(rates.salaryPence)}
              </span>
            </div>
          )}

          {rates.employmentTypes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {rates.employmentTypes.includes('contract') && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
                  Contract
                </span>
              )}
              {rates.employmentTypes.includes('permanent') && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
                  Permanent
                </span>
              )}
            </div>
          )}

          {rates.ir35Statuses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {rates.ir35Statuses.includes('inside') && (
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-300">
                  Inside IR35
                </span>
              )}
              {rates.ir35Statuses.includes('outside') && (
                <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-300">
                  Outside IR35
                </span>
              )}
            </div>
          )}

          {rates.hasLtdCo && (
            <span className="inline-block rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-300">
              Ltd Co
            </span>
          )}

          {rates.location && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-white/60">Location</span>
              <span className="text-sm text-white">{rates.location.displayName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
