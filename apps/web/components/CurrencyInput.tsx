'use client';

import { useState, useCallback } from 'react';

interface CurrencyInputProps {
  /** Value in pence (e.g., 75000 = £750.00). Null for empty. */
  value: number | null;
  /** Called with pence value on blur. Null if empty. */
  onChange: (pence: number | null) => void;
  placeholder?: string;
  label?: string;
  id?: string;
}

/**
 * Format pence to pounds string with thousand separators.
 * 75000 -> "750.00"
 * 12500000 -> "125,000.00"
 */
function penceToPoundsDisplay(pence: number): string {
  const pounds = pence / 100;
  return pounds.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parse pounds string to pence.
 * "750.00" -> 75000
 * "125,000.50" -> 12500050
 */
function poundsToPence(pounds: string): number | null {
  const cleaned = pounds.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = '0.00',
  label,
  id,
}: CurrencyInputProps) {
  // Display value tracks the raw input for editing
  const [displayValue, setDisplayValue] = useState<string>(
    value !== null ? penceToPoundsDisplay(value) : ''
  );
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Remove formatting for easier editing
    if (value !== null) {
      setDisplayValue((value / 100).toString());
    }
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const pence = poundsToPence(displayValue);
    onChange(pence);
    // Reformat with separators
    if (pence !== null) {
      setDisplayValue(penceToPoundsDisplay(pence));
    } else {
      setDisplayValue('');
    }
  }, [displayValue, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only numbers, decimal point, and commas
    const raw = e.target.value.replace(/[^0-9.,]/g, '');
    setDisplayValue(raw);
  }, []);

  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">£</span>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/15 bg-[var(--color-bg-primary)] py-2.5 pl-8 pr-4 text-white placeholder:text-white/30 outline-none focus:border-[var(--color-accent)]"
        />
      </div>
    </div>
  );
}
