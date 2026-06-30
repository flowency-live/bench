'use client';

import { useState } from 'react';
import { sendEditLink } from './invite-actions';
import { ShareLinkActions } from '@/components/ShareLinkActions';

/**
 * Owner control to send a consultant a single-use link to edit their OWN profile
 * (wizard mode). Unlike "Send invite", this does not unpublish an active profile.
 * Generates the link and surfaces Copy / WhatsApp / Email / SMS so the admin
 * shares it however they like.
 */
export function SendEditLinkButton({
  profileId,
  consultantName,
}: {
  profileId: string;
  consultantName?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const path = await sendEditLink(profileId);
      setUrl(`${window.location.origin}${path}`);
    } catch {
      setError('Could not create an edit link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (url) {
    const who = consultantName ? `${consultantName.split(' ')[0]}, ` : '';
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[var(--color-text-secondary)]">
          Single-use edit link{consultantName ? ` for ${consultantName}` : ''}. They can update their
          own profile; rates stay admin-only.
        </p>
        <ShareLinkActions
          url={url}
          shareMessage={`${who}here's your single-use link to update your profile:`}
          subject="Update your profile"
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
        className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Send edit link'}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
