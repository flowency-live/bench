'use client';

import { useRef, useState, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectDropdownProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => {
    onChange(options.map((o) => o.value));
  };

  const clearAll = () => {
    onChange([]);
  };

  const displayText =
    selected.length === 0
      ? 'All'
      : selected.length === options.length
        ? 'All'
        : selected.length === 1
          ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
          : `${selected.length}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 border border-white/15 bg-white/[0.02] px-3 py-1.5 text-xs transition hover:border-white/30"
      >
        <span className="text-[var(--color-text-secondary)] uppercase tracking-wider">{label}</span>
        <span className="text-white font-medium">{displayText}</span>
        <svg
          className={`h-3 w-3 text-white/50 transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] border border-white/15 bg-[var(--color-bg-panel)] py-1 shadow-xl">
          <div className="flex gap-2 border-b border-white/10 px-3 py-1.5 mb-1">
            <button
              type="button"
              onClick={selectAll}
              className="text-[10px] uppercase tracking-wider text-[var(--color-accent)] hover:underline"
            >
              All
            </button>
            <span className="text-white/20">|</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] uppercase tracking-wider text-[var(--color-accent)] hover:underline"
            >
              None
            </button>
          </div>
          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-white/5"
              >
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center border ${
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                      : 'border-white/30'
                  }`}
                >
                  {isSelected && (
                    <svg className="h-2.5 w-2.5 text-[var(--color-bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className={isSelected ? 'text-white' : 'text-[var(--color-text-secondary)]'}>
                  {option.label}
                </span>
                {option.count !== undefined && (
                  <span className="ml-auto font-mono text-[10px] text-white/40">{option.count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
