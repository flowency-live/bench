'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface BrandedDatePickerProps {
  value: string; // ISO date string (YYYY-MM-DD)
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minDate?: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDisplayDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format a Date object as YYYY-MM-DD string */
function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Monday = 0, Sunday = 6 (ISO week)
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];

  // Fill empty days before first of month
  for (let i = 0; i < startDay; i++) {
    week.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  // Fill remaining days in last week
  if (week.length > 0) {
    while (week.length < 7) {
      week.push(null);
    }
    weeks.push(week);
  }

  return weeks;
}

export function BrandedDatePicker({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  minDate,
}: BrandedDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (value) return new Date(value).getFullYear();
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return new Date(value).getMonth();
    return new Date().getMonth();
  });
  const ref = useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value) : null;
  const minDateObj = minDate ? new Date(minDate) : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDayClick = useCallback((day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    if (minDateObj && date < minDateObj) return;

    onChange(toISODateString(date));
    setIsOpen(false);
  }, [viewYear, viewMonth, minDateObj, onChange]);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }, [viewMonth, viewYear]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }, [viewMonth, viewYear]);

  const weeks = getMonthGrid(viewYear, viewMonth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      viewMonth === today.getMonth() &&
      viewYear === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      viewMonth === selectedDate.getMonth() &&
      viewYear === selectedDate.getFullYear()
    );
  };

  const isDisabled = (day: number) => {
    if (!minDateObj) return false;
    const date = new Date(viewYear, viewMonth, day);
    return date < minDateObj;
  };

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between border border-white/15 bg-[var(--color-bg-primary)] px-4 py-2.5 text-left text-white transition hover:border-white/30 focus:border-[var(--color-accent)] focus:outline-none"
      >
        <span className={value ? 'text-white' : 'text-white/40'}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <svg
          className="h-4 w-4 text-white/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect x="3" y="4" width="18" height="18" rx="0" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[280px] border border-white/15 bg-[var(--color-bg-panel)] p-3 shadow-xl">
          {/* Month/Year Header */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-white">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day Headers */}
          <div className="mb-1 grid grid-cols-7 gap-0">
            {DAYS.map((day) => (
              <div
                key={day}
                className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0">
            {weeks.map((week, weekIndex) =>
              week.map((day, dayIndex) => {
                if (day === null) {
                  return <div key={`empty-${weekIndex}-${dayIndex}`} className="h-8" />;
                }

                const disabled = isDisabled(day);
                const selected = isSelected(day);
                const todayStyle = isToday(day);

                return (
                  <button
                    key={`${weekIndex}-${day}`}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    disabled={disabled}
                    className={`
                      flex h-8 items-center justify-center text-sm font-medium transition
                      ${disabled
                        ? 'cursor-not-allowed text-white/20'
                        : selected
                          ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                          : todayStyle
                            ? 'border border-[var(--color-accent)] text-[var(--color-accent)]'
                            : 'text-white hover:bg-white/10'
                      }
                    `}
                  >
                    {day}
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => {
                onChange(toISODateString(new Date()));
                setIsOpen(false);
              }}
              className="flex-1 border border-white/10 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] transition hover:border-white/30 hover:text-white"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                onChange(toISODateString(nextWeek));
                setIsOpen(false);
              }}
              className="flex-1 border border-white/10 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] transition hover:border-white/30 hover:text-white"
            >
              +1 Week
            </button>
            <button
              type="button"
              onClick={() => {
                const nextMonth = new Date();
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                onChange(toISODateString(nextMonth));
                setIsOpen(false);
              }}
              className="flex-1 border border-white/10 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] transition hover:border-white/30 hover:text-white"
            >
              +1 Month
            </button>
          </div>

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="mt-2 w-full border border-white/10 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-400 transition hover:border-red-400/30 hover:bg-red-400/10"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
