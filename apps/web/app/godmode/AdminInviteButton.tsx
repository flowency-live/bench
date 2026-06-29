'use client';

import { useState } from 'react';
import { resendAdminInvite } from './actions';
import { ShareLinkActions } from '@/components/ShareLinkActions';

/**
 * Godmode control to (re)issue a tenant admin's onboarding / sign-in link (ISS-1).
 *
 * Calls the `resendAdminInvite` server action (mints a fresh single-use link and
 * returns it), composes the absolute URL from the current origin, then reveals
 * Copy / WhatsApp / Email / SMS so the platform admin shares it however they like
 * (not auto-email-only). Pending admins get an onboarding link; active admins a
 * sign-in link (e.g. a new device).
 */
export function AdminInviteButton({
  tenantId,
  userId,
  email,
  status,
}: {
  tenantId: string;
  userId: string;
  email: string;
  status: 'pending' | 'active';
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = status === 'pending';
  const label = isPending ? 'Send invite link' : 'Resend sign-in link';
  const subject = isPending ? 'Your Bench admin invite' : 'Your Bench sign-in link';
  const shareMessage = isPending
    ? `You've been invited to administer your team on Bench. Use this single-use link to set up your account:`
    : `Here's your single-use sign-in link for Bench:`;

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await resendAdminInvite(tenantId, userId);
      if (res.ok && res.link) {
        setUrl(`${window.location.origin}${res.link}`);
      } else {
        setError(res.error ?? 'Could not create a link. Please try again.');
      }
    } catch {
      setError('Could not create a link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (url) {
    return (
      <div className="mt-2 w-full">
        <p className="mb-2 text-[11px] text-[var(--color-text-secondary)]">
          Single-use link for {email}. Expires in 30 minutes.
        </p>
        <ShareLinkActions url={url} shareMessage={shareMessage} subject={subject} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="rounded-full border border-[var(--color-accent)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Creating…' : label}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
