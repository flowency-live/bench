'use client';

import { useState } from 'react';
import { createShareLink } from '@/app/actions';

/**
 * Owner control to mint a no-auth share link for a published profile.
 *
 * Clicking calls the `createShareLink` server action (which returns a relative
 * `/share/{token}` path), composes the absolute URL from the current origin,
 * then surfaces it with a copy-to-clipboard button. The raw token is shown
 * once here; only its hash is persisted server-side.
 */
export function ShareLinkButton({ profileId }: { profileId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const path = await createShareLink(profileId);
      setUrl(`${window.location.origin}${path}`);
      setCopied(false);
    } catch {
      setError('Could not create a share link. Please try again.');
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
          aria-label="Share link"
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
        className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Share link'}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
