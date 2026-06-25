'use client';

import { useState } from 'react';
import { sendInvite } from './invite-actions';

/**
 * Owner control to invite a consultant to build their own profile.
 *
 * Clicking calls the `sendInvite` server action (which mints a 14-day invite
 * link, sets the profile to `invited`, and returns a relative `/invite/{token}`
 * path), composes the absolute URL from the current origin, then surfaces it
 * with a copy button. The raw token is shown once here; only its hash is
 * persisted server-side. (In production this link will also be emailed.)
 */
export function SendInviteButton({ profileId }: { profileId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const path = await sendInvite(profileId);
      setUrl(`${window.location.origin}${path}`);
      setCopied(false);
    } catch {
      setError('Could not create an invite link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — select the link and copy it manually.');
    }
  }

  if (url) {
    return (
      <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-white/20 bg-[var(--color-bg-panel)] py-1 pl-4 pr-1">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
          aria-label="Invite link"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-black uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-95"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="rounded-full border border-[var(--color-accent)] px-4 py-1.5 text-sm font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Send invite'}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
