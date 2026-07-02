'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface MobileMenuProps {
  isAdmin: boolean;
  isPlatform: boolean;
  isMember: boolean;
  email: string | null;
}

/**
 * Mobile hamburger menu for the app header.
 * Provides full navigation access on small screens.
 */
export function MobileMenu({ isAdmin, isPlatform, isMember, email }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      {/* Hamburger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/5 hover:text-white"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Overlay + Menu */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Menu panel */}
          <nav
            className="fixed right-0 top-0 z-50 h-full w-72 bg-[var(--color-bg-panel)] shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
              <span className="text-sm font-semibold text-white">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/5 hover:text-white"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation links */}
            <div className="flex flex-col p-4">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              >
                <svg className="h-5 w-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Collective
              </Link>

              {(isAdmin || isPlatform) && (
                <>
                  <Link
                    href="/clients"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
                  >
                    <svg className="h-5 w-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Clients
                  </Link>
                  <Link
                    href="/team"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
                  >
                    <svg className="h-5 w-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    Team
                  </Link>
                </>
              )}

              <Link
                href="/dashboard/new"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-3 text-sm font-bold uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-110"
              >
                <span className="text-lg leading-none">+</span>
                Add consultant
              </Link>

              {/* Divider */}
              <div className="my-4 border-t border-white/10" />

              {/* Account section */}
              <div className="space-y-1">
                <span className="px-4 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Account
                </span>

                {isPlatform && (
                  <>
                    <div className="mx-4 my-2 flex items-center gap-2">
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                        Godmode
                      </span>
                    </div>
                    <Link
                      href="/godmode"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Back to godmode
                    </Link>
                  </>
                )}

                {isAdmin && email && (
                  <Link
                    href="/settings"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{email}</span>
                  </Link>
                )}

                {isMember && (
                  <div className="flex items-center gap-3 px-4 py-3 text-sm text-white/50">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Consultant
                  </div>
                )}

                <a
                  href="/auth/logout"
                  className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-red-400 transition hover:bg-red-500/10"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </a>
              </div>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
