'use client';

import { useState } from 'react';

interface Props {
  email: string;
  phone: string | null;
  googleId: string | null;
  appleId: string | null;
  phoneLinkedAt: string | null;
  googleLinkedAt: string | null;
  appleLinkedAt: string | null;
}

/**
 * Security settings form — manage linked sign-in methods.
 *
 * Email is always linked (primary method). Phone, Google, and Apple can be
 * linked or unlinked. Must keep at least one method linked at all times.
 */
export function SecuritySettingsForm({
  email,
  phone,
  googleId,
  appleId,
  phoneLinkedAt,
  googleLinkedAt,
  appleLinkedAt,
}: Props) {
  // Count linked methods (email always counts as 1)
  const linkedCount =
    1 + (phone ? 1 : 0) + (googleId ? 1 : 0) + (appleId ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Email — always linked, cannot remove */}
      <MethodCard
        icon={<EmailIcon />}
        label="Email"
        detail={email}
        linkedAt={null}
        isPrimary
        canUnlink={false}
      />

      {/* Phone */}
      <MethodCard
        icon={<PhoneIcon />}
        label="Phone"
        detail={phone ? formatPhone(phone) : null}
        linkedAt={phoneLinkedAt}
        isPrimary={false}
        canUnlink={linkedCount > 1}
        onLink={() => {
          // TODO: Open phone verification modal
          alert('Phone linking coming soon');
        }}
        onUnlink={() => {
          // TODO: Unlink phone
          alert('Phone unlinking coming soon');
        }}
      />

      {/* Google */}
      <MethodCard
        icon={<GoogleIcon />}
        label="Google"
        detail={googleId ? 'Connected' : null}
        linkedAt={googleLinkedAt}
        isPrimary={false}
        canUnlink={linkedCount > 1}
        onLink={() => {
          // TODO: Redirect to Google OAuth
          alert('Google linking coming soon');
        }}
        onUnlink={() => {
          // TODO: Unlink Google
          alert('Google unlinking coming soon');
        }}
      />

      {/* Apple */}
      <MethodCard
        icon={<AppleIcon />}
        label="Apple"
        detail={appleId ? 'Connected' : null}
        linkedAt={appleLinkedAt}
        isPrimary={false}
        canUnlink={linkedCount > 1}
        onLink={() => {
          // TODO: Redirect to Apple OAuth
          alert('Apple linking coming soon');
        }}
        onUnlink={() => {
          // TODO: Unlink Apple
          alert('Apple unlinking coming soon');
        }}
      />

      <p className="mt-6 text-xs text-[var(--color-text-secondary)]">
        You must keep at least one sign-in method linked at all times.
      </p>
    </div>
  );
}

interface MethodCardProps {
  icon: React.ReactNode;
  label: string;
  detail: string | null;
  linkedAt: string | null;
  isPrimary: boolean;
  canUnlink: boolean;
  onLink?: () => void;
  onUnlink?: () => void;
}

function MethodCard({
  icon,
  label,
  detail,
  linkedAt,
  isPrimary,
  canUnlink,
  onLink,
  onUnlink,
}: MethodCardProps) {
  const isLinked = detail !== null;

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{label}</span>
            {isPrimary && (
              <span className="rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent)]">
                Primary
              </span>
            )}
          </div>
          {isLinked ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {detail}
              {linkedAt && (
                <span className="ml-2 text-xs">
                  (linked {formatDate(linkedAt)})
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Not linked
            </p>
          )}
        </div>
      </div>

      {!isPrimary && (
        <div>
          {isLinked ? (
            <button
              type="button"
              onClick={onUnlink}
              disabled={!canUnlink}
              className="rounded-full border border-red-400/50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-red-400 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                canUnlink
                  ? `Unlink ${label}`
                  : 'Cannot remove last sign-in method'
              }
            >
              Unlink
            </button>
          ) : (
            <button
              type="button"
              onClick={onLink}
              className="rounded-full border border-[var(--color-accent)] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
            >
              Link
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatPhone(phone: string): string {
  // Simple formatting for E.164 numbers
  if (phone.startsWith('+44') && phone.length === 13) {
    return `+44 ${phone.slice(3, 7)} ${phone.slice(7)}`;
  }
  return phone;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function EmailIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}
