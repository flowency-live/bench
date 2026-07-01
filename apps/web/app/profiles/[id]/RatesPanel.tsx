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
const labelStyle =
  'text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]';

function formatPounds(pence: number | null): string {
  if (pence === null) return '';
  return Math.round(pence / 100).toLocaleString('en-GB');
}

function parsePounds(value: string): number | null {
  const cleaned = value.replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  return parseInt(cleaned, 10) * 100;
}

/** Styled checkbox */
function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <span
      onClick={() => onChange(!checked)}
      className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center border transition ${
        checked
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
          : 'border-white/30 bg-transparent hover:border-white/50'
      }`}
    >
      {checked && (
        <svg
          className="h-3.5 w-3.5 text-[var(--color-bg-primary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
  );
}

/** Rate input with currency symbol */
function RateInput({
  id,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
        £
      </span>
      <input
        id={id}
        type="text"
        className={`${field} pl-7 pr-16`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function RatesPanel({ profileId, rates }: RatesPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Rate type toggles
  const [outsideIR35Enabled, setOutsideIR35Enabled] = useState(
    rates?.ir35Statuses?.includes('outside') ?? false,
  );
  const [insideIR35Enabled, setInsideIR35Enabled] = useState(
    rates?.ir35Statuses?.includes('inside') ?? false,
  );
  const [permanentEnabled, setPermanentEnabled] = useState(
    rates?.employmentTypes?.includes('permanent') ?? false,
  );

  // Rate values
  const [outsideIR35Rate, setOutsideIR35Rate] = useState(
    rates?.outsideIR35RatePence ? formatPounds(rates.outsideIR35RatePence) : '',
  );
  const [insideIR35Rate, setInsideIR35Rate] = useState(
    rates?.insideIR35RatePence ? formatPounds(rates.insideIR35RatePence) : '',
  );
  const [salary, setSalary] = useState(
    rates?.salaryPence ? formatPounds(rates.salaryPence) : '',
  );
  const [hasLtdCo, setHasLtdCo] = useState(rates?.hasLtdCo ?? false);

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const employmentTypes: EmploymentType[] = [];
      const ir35Statuses: IR35Status[] = [];

      if (outsideIR35Enabled || insideIR35Enabled) {
        employmentTypes.push('contract');
      }
      if (permanentEnabled) {
        employmentTypes.push('permanent');
      }
      if (outsideIR35Enabled) {
        ir35Statuses.push('outside');
      }
      if (insideIR35Enabled) {
        ir35Statuses.push('inside');
      }

      const newRates: RatesAndPreferences = {
        outsideIR35RatePence: outsideIR35Enabled ? parsePounds(outsideIR35Rate) : null,
        insideIR35RatePence: insideIR35Enabled ? parsePounds(insideIR35Rate) : null,
        salaryPence: permanentEnabled ? parsePounds(salary) : null,
        employmentTypes,
        ir35Statuses,
        hasLtdCo: outsideIR35Enabled ? hasLtdCo : false,
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
    setOutsideIR35Enabled(rates?.ir35Statuses?.includes('outside') ?? false);
    setInsideIR35Enabled(rates?.ir35Statuses?.includes('inside') ?? false);
    setPermanentEnabled(rates?.employmentTypes?.includes('permanent') ?? false);
    setOutsideIR35Rate(rates?.outsideIR35RatePence ? formatPounds(rates.outsideIR35RatePence) : '');
    setInsideIR35Rate(rates?.insideIR35RatePence ? formatPounds(rates.insideIR35RatePence) : '');
    setSalary(rates?.salaryPence ? formatPounds(rates.salaryPence) : '');
    setHasLtdCo(rates?.hasLtdCo ?? false);
    setIsEditing(false);
    setError(null);
  };

  if (isEditing) {
    return (
      <div className="border border-white/10 bg-[var(--color-bg-panel)] p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Rates & Preferences</h3>
          <span className="text-xs text-[var(--color-text-secondary)]">Admin only</span>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="space-y-4">
          {/* Outside IR35 Group */}
          <div className="border border-white/10 bg-white/[0.02] p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <Checkbox checked={outsideIR35Enabled} onChange={setOutsideIR35Enabled} />
              <div>
                <span className="text-sm font-semibold text-white">Outside IR35</span>
                <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                  Contract via Ltd or umbrella
                </span>
              </div>
            </label>

            {outsideIR35Enabled && (
              <div className="mt-4 space-y-3 pl-8">
                <div>
                  <label htmlFor="outsideRate" className={`mb-1.5 block ${labelStyle}`}>
                    Day rate
                  </label>
                  <RateInput
                    id="outsideRate"
                    value={outsideIR35Rate}
                    onChange={setOutsideIR35Rate}
                    placeholder="750"
                    suffix="/day"
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-3 text-sm text-white/80">
                  <Checkbox checked={hasLtdCo} onChange={setHasLtdCo} />
                  Has Ltd Co
                </label>
              </div>
            )}
          </div>

          {/* Inside IR35 Group */}
          <div className="border border-white/10 bg-white/[0.02] p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <Checkbox checked={insideIR35Enabled} onChange={setInsideIR35Enabled} />
              <div>
                <span className="text-sm font-semibold text-white">Inside IR35</span>
                <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                  Contract via agency PAYE
                </span>
              </div>
            </label>

            {insideIR35Enabled && (
              <div className="mt-4 pl-8">
                <label htmlFor="insideRate" className={`mb-1.5 block ${labelStyle}`}>
                  Day rate
                </label>
                <RateInput
                  id="insideRate"
                  value={insideIR35Rate}
                  onChange={setInsideIR35Rate}
                  placeholder="650"
                  suffix="/day"
                />
              </div>
            )}
          </div>

          {/* Permanent Group */}
          <div className="border border-white/10 bg-white/[0.02] p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <Checkbox checked={permanentEnabled} onChange={setPermanentEnabled} />
              <div>
                <span className="text-sm font-semibold text-white">Permanent</span>
                <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                  Full-time employed role
                </span>
              </div>
            </label>

            {permanentEnabled && (
              <div className="mt-4 pl-8">
                <label htmlFor="salary" className={`mb-1.5 block ${labelStyle}`}>
                  Target salary
                </label>
                <RateInput
                  id="salary"
                  value={salary}
                  onChange={setSalary}
                  placeholder="95,000"
                  suffix="/year"
                />
              </div>
            )}
          </div>

          {/* Location (read-only) */}
          {rates?.location && (
            <div className="border-t border-white/10 pt-4">
              <span className={labelStyle}>Location</span>
              <p className="mt-1 text-sm text-white">{rates.location.displayName}</p>
            </div>
          )}
        </div>

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

  // Display view
  const hasRates =
    rates &&
    ((rates.ir35Statuses?.length ?? 0) > 0 || rates.employmentTypes?.includes('permanent'));

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

      {!hasRates ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No rates configured</p>
      ) : (
        <div className="space-y-3">
          {/* Outside IR35 */}
          {rates.ir35Statuses?.includes('outside') && rates.outsideIR35RatePence !== null && (
            <div className="flex items-center justify-between border-l-2 border-green-500 pl-3">
              <div>
                <span className="text-sm font-medium text-white">Outside IR35</span>
                {rates.hasLtdCo && (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-purple-400">
                    Ltd Co
                  </span>
                )}
              </div>
              <span className="font-mono text-lg font-semibold text-white">
                £{formatPounds(rates.outsideIR35RatePence)}/day
              </span>
            </div>
          )}

          {/* Inside IR35 */}
          {rates.ir35Statuses?.includes('inside') && rates.insideIR35RatePence !== null && (
            <div className="flex items-center justify-between border-l-2 border-blue-500 pl-3">
              <span className="text-sm font-medium text-white">Inside IR35</span>
              <span className="font-mono text-lg font-semibold text-white">
                £{formatPounds(rates.insideIR35RatePence)}/day
              </span>
            </div>
          )}

          {/* Permanent */}
          {rates.employmentTypes?.includes('permanent') && rates.salaryPence !== null && (
            <div className="flex items-center justify-between border-l-2 border-amber-500 pl-3">
              <span className="text-sm font-medium text-white">Permanent</span>
              <span className="font-mono text-lg font-semibold text-white">
                £{formatPounds(rates.salaryPence)}/year
              </span>
            </div>
          )}

          {/* Location */}
          {rates.location && (
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-sm text-[var(--color-text-secondary)]">Location</span>
              <span className="text-sm text-white">{rates.location.displayName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
