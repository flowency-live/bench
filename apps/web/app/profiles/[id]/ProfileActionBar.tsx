'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { Availability, ProfileStatus } from '@/lib/types';
import { StatusControls } from './StatusControls';

interface ProfileActionBarProps {
  profileId: string;
  profileName: string;
  profileStatus: ProfileStatus;
  profileAvailability: Availability;
  children?: React.ReactNode; // For ShareLinkButton, SendInviteButton, SendEditLinkButton
}

/**
 * Unified action bar for the profile page.
 * Organizes navigation, status, primary actions, and secondary actions
 * into a clean, visually structured toolbar.
 */
export function ProfileActionBar({
  profileId,
  profileName,
  profileStatus,
  profileAvailability,
  children,
}: ProfileActionBarProps) {
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const pdfMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(e.target as Node)) {
        setPdfMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pdfOptions = [
    { label: 'Dark Portrait', href: `/profiles/${profileId}/print?o=portrait&theme=dark` as const },
    { label: 'Dark Landscape', href: `/profiles/${profileId}/print?o=landscape&theme=dark` as const },
    { label: 'Light Portrait', href: `/profiles/${profileId}/print?o=portrait&theme=light` as const },
    { label: 'Light Landscape', href: `/profiles/${profileId}/print?o=landscape&theme=light` as const },
  ];

  return (
    <div className="mb-8">
      {/* Top row: Navigation and status */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-accent)]"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Collective
          </Link>
          <span className="h-4 w-px bg-white/10" aria-hidden="true" />
          <span className="text-sm font-medium text-white/90">{profileName}</span>
        </div>
        <StatusControls
          profileId={profileId}
          currentStatus={profileStatus}
          currentAvailability={profileAvailability}
        />
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
        {/* Primary action */}
        <Link
          href={`/profiles/${profileId}/edit`}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-bg-primary)] transition hover:brightness-110"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit profile
        </Link>

        {/* Secondary actions group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* PDF Export dropdown */}
          <div className="relative" ref={pdfMenuRef}>
            <button
              type="button"
              onClick={() => setPdfMenuOpen(!pdfMenuOpen)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/12 px-3 py-2 text-sm font-medium text-white/80 transition hover:border-white/25 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF
              <svg
                className={`h-3 w-3 transition-transform ${pdfMenuOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {pdfMenuOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-48 origin-top-right animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="rounded-lg border border-white/10 bg-[var(--color-bg-panel)] p-1 shadow-xl shadow-black/20">
                  <div className="px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Choose format
                    </span>
                  </div>
                  {pdfOptions.map((opt) => (
                    <Link
                      key={opt.href}
                      href={opt.href}
                      target="_blank"
                      rel="noopener"
                      onClick={() => setPdfMenuOpen(false)}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          opt.label.includes('Dark') ? 'bg-slate-700' : 'bg-slate-200'
                        }`}
                      />
                      {opt.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Vertical divider */}
          <span className="hidden h-6 w-px bg-white/10 sm:block" aria-hidden="true" />

          {/* Share/Invite actions slot */}
          <div className="flex flex-wrap items-center gap-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
