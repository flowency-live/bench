'use client';

import { useState, useTransition } from 'react';
import { updateRates, type RatesActionState } from './rates-actions';
import type { RatesAndPreferences, EmploymentType, IR35Status } from '@/lib/types';

interface RatesPanelProps {
  profileId: string;
  rates: RatesAndPreferences | null;
}

const field =
  'w-full border border-white/15 bg-[var(--color-bg-primary)] px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-[var(--color-accent)]';
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

/** Styled checkbox for rate type selection */
function RateTypeCheckbox({
  checked,
  onChange,
  label: labelText,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border transition ${
          checked
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
            : 'border-white/30 bg-transparent'
        }`}
      >
        {checked && (
          <svg className="h-3 w-3 text-[var(--color-bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <div className="flex-1">
        <span className="text-sm font-medium text-white">{labelText}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">{description}</span>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
    </label>
  );
}

export function RatesPanel({ profileId, rates }: RatesPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Rate type selection (determines which rate inputs are shown)
  const [showOutsideIR35, setShowOutsideIR35] = useState(
    rates?.ir35Statuses?.includes('outside') ?? false,
  );
  const [showInsideIR35, setShowInsideIR35] = useState(
    rates?.ir35Statuses?.includes('inside') ?? false,
  );
  const [showPermanent, setShowPermanent] = useState(
    rates?.employmentTypes?.includes('permanent') ?? false,
  );

  // Rate values
  const [dayRate, setDayRate] = useState(rates?.minDayRatePence ? formatPounds(rates.minDayRatePence) : '');
  const [salary, setSalary] = useState(rates?.salaryPence ? formatPounds(rates.salaryPence) : '');
  const [hasLtdCo, setHasLtdCo] = useState(rates?.hasLtdCo ?? false);

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      // Build employment types and IR35 statuses from selections
      const employmentTypes: EmploymentType[] = [];
      const ir35Statuses: IR35Status[] = [];

      if (showOutsideIR35 || showInsideIR35) {
        employmentTypes.push('contract');
      }
      if (showPermanent) {
        employmentTypes.push('permanent');
      }
      if (showOutsideIR35) {
        ir35Statuses.push('outside');
      }
      if (showInsideIR35) {
        ir35Statuses.push('inside');
      }

      const newRates: RatesAndPreferences = {
        minDayRatePence: (showOutsideIR35 || showInsideIR35) ? parsePounds(dayRate) : null,
        salaryPence: showPermanent ? parsePounds(salary) : null,
        employmentTypes,
        ir35Statuses,
        hasLtdCo: showOutsideIR35 ? hasLtdCo : false,
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
    setShowOutsideIR35(rates?.ir35Statuses?.includes('outside') ?? false);
    setShowInsideIR35(rates?.ir35Statuses?.includes('inside') ?? false);
    setShowPermanent(rates?.employmentTypes?.includes('permanent') ?? false);
    setDayRate(rates?.minDayRatePence ? formatPounds(rates.minDayRatePence) : '');
    setSalary(rates?.salaryPence ? formatPounds(rates.salaryPence) : '');
    setHasLtdCo(rates?.hasLtdCo ?? false);
    setIsEditing(false);
    setError(null);
  };

  const hasAnyRateTypeSelected = showOutsideIR35 || showInsideIR35 || showPermanent;

  if (isEditing) {
    return (
      <div className="border border-white/10 bg-[var(--color-bg-panel)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Rates & Preferences</h3>
          <span className="text-xs text-[var(--color-text-secondary)]">Admin only</span>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-400">{error}</p>
        )}

        {/* Step 1: Select rate types */}
        <div className="mb-6">
          <span className={label}>Select rate types</span>
          <div className="space-y-2">
            <RateTypeCheckbox
              checked={showOutsideIR35}
              onChange={setShowOutsideIR35}
              label="Outside IR35"
              description="Contract work via Ltd or umbrella"
            />
            <RateTypeCheckbox
              checked={showInsideIR35}
              onChange={setShowInsideIR35}
              label="Inside IR35"
              description="Contract via agency PAYE"
            />
            <RateTypeCheckbox
              checked={showPermanent}
              onChange={setShowPermanent}
              label="Permanent"
              description="Full-time employed role"
            />
          </div>
        </div>

        {/* Step 2: Show rate inputs based on selection */}
        {hasAnyRateTypeSelected && (
          <div className="space-y-4 border-t border-white/10 pt-4">
            {/* Contract day rate (shown if either IR35 type selected) */}
            {(showOutsideIR35 || showInsideIR35) && (
              <div>
                <label className={label} htmlFor="dayRate">
                  Day rate {showOutsideIR35 && showInsideIR35 ? '(contract)' : showOutsideIR35 ? '(outside IR35)' : '(inside IR35)'}
                </label>
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
            )}

            {/* Ltd Co checkbox (only shown for Outside IR35) */}
            {showOutsideIR35 && (
              <label className="flex cursor-pointer items-center gap-3 text-sm text-white/80">
                <span
                  className={`flex h-4 w-4 items-center justify-center border transition ${
                    hasLtdCo
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                      : 'border-white/30 bg-transparent'
                  }`}
                >
                  {hasLtdCo && (
                    <svg className="h-3 w-3 text-[var(--color-bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                Has Ltd Co
                <input
                  type="checkbox"
                  checked={hasLtdCo}
                  onChange={(e) => setHasLtdCo(e.target.checked)}
                  className="sr-only"
                />
              </label>
            )}

            {/* Target salary (shown for Permanent) */}
            {showPermanent && (
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
            )}

            {/* Location (read-only display if set) */}
            {rates?.location && (
              <div>
                <span className={label}>Location</span>
                <p className="text-sm text-white">{rates.location.displayName}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="border border-white/20 px-4 py-1.5 text-sm font-semibold text-white/70 transition hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="bg-[var(--color-accent)] px-4 py-1.5 text-sm font-black uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-95 disabled:opacity-50"
          >
            {pending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-white/10 bg-[var(--color-bg-panel)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-black text-white">Rates & Preferences</h3>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="border border-white/20 px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          Edit
        </button>
      </div>

      {!rates ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No rates configured</p>
      ) : (
        <div className="space-y-3">
          {/* Outside IR35 rate */}
          {rates.ir35Statuses.includes('outside') && rates.minDayRatePence !== null && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Outside IR35</span>
              <span className="font-mono text-lg font-semibold text-white">
                £{formatPounds(rates.minDayRatePence)}/day
              </span>
            </div>
          )}

          {/* Inside IR35 rate */}
          {rates.ir35Statuses.includes('inside') && rates.minDayRatePence !== null && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Inside IR35</span>
              <span className="font-mono text-lg font-semibold text-white">
                £{formatPounds(rates.minDayRatePence)}/day
              </span>
            </div>
          )}

          {/* Permanent salary */}
          {rates.employmentTypes.includes('permanent') && rates.salaryPence !== null && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Permanent</span>
              <span className="font-mono text-lg font-semibold text-white">
                £{formatPounds(rates.salaryPence)}/year
              </span>
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2 pt-2">
            {rates.ir35Statuses.includes('outside') && (
              <span className="border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-400">
                Outside IR35
              </span>
            )}
            {rates.ir35Statuses.includes('inside') && (
              <span className="border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                Inside IR35
              </span>
            )}
            {rates.hasLtdCo && (
              <span className="border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-400">
                Ltd Co
              </span>
            )}
            {rates.employmentTypes.includes('permanent') && (
              <span className="border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                Permanent
              </span>
            )}
          </div>

          {rates.location && (
            <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
              <span className="text-sm text-[var(--color-text-secondary)]">Location</span>
              <span className="text-sm text-white">{rates.location.displayName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
