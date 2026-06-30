'use client';

import { useState } from 'react';
import { generateBuilderLink } from '@/app/actions';
import { ShareLinkActions } from '@/components/ShareLinkActions';

/**
 * Dashboard control to generate a REUSABLE "new consultant" builder link.
 *
 * Anyone the admin shares it with starts a fresh profile (no pre-created record
 * needed). Valid 30 days; generate again for a new one. Shown with
 * Copy / WhatsApp / Email / SMS so the admin shares it however they like.
 */
export function BuilderLinkButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const path = await generateBuilderLink();
      setUrl(`${window.location.origin}${path}`);
    } catch {
      setError('Could not create a link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (url) {
    return (
      <div className="flex w-full flex-col gap-2">
        <p className="text-xs text-[var(--color-text-secondary)]">
          Reusable invite link (valid 30 days). Anyone who opens it starts a new consultant profile.
        </p>
        <ShareLinkActions
          url={url}
          shareMessage="Build your consultant profile here:"
          subject="Build your consultant profile"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/80 transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Invite new consultant (link)'}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
