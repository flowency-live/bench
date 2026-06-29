'use client';

import { useState, useEffect } from 'react';
import { createShareLink, getActiveShareLink, revokeShareLink } from '@/app/actions';

interface ActiveLinkData {
  id: string;
  createdAt: string;
}

/**
 * Owner control to manage share links for a published profile.
 *
 * If an active share link exists, shows metadata (created date) with
 * Deactivate button. Users can create a new link to get a shareable URL.
 *
 * When a new link is created, the URL is shown once with Copy/WhatsApp/Email/SMS
 * share options. The raw token is shown only at creation time; we persist
 * only its SHA-256 hash server-side.
 */
export function ShareLinkButton({
  profileId,
  consultantName,
}: {
  profileId: string;
  consultantName?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [activeLink, setActiveLink] = useState<ActiveLinkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingActive, setCheckingActive] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareMessage = consultantName
    ? `Check out ${consultantName}'s consultant profile:`
    : 'Check out this consultant profile:';

  // Check for existing active link on mount
  useEffect(() => {
    async function checkActiveLink() {
      try {
        const link = await getActiveShareLink(profileId);
        setActiveLink(link);
      } catch {
        // Ignore errors - just show create button
      } finally {
        setCheckingActive(false);
      }
    }
    checkActiveLink();
  }, [profileId]);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const path = await createShareLink(profileId);
      setUrl(`${window.location.origin}${path}`);
      setActiveLink(null); // Clear active link state since we now have a URL
      setCopied(false);
    } catch {
      setError('Could not create a share link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function deactivate() {
    if (!activeLink) return;
    setLoading(true);
    setError(null);
    try {
      await revokeShareLink(profileId, activeLink.id);
      setActiveLink(null);
      setUrl(null);
    } catch {
      setError('Could not deactivate the share link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function deactivateFromUrl() {
    // When deactivating from URL view, we need to fetch the current active link first
    setLoading(true);
    setError(null);
    try {
      const link = await getActiveShareLink(profileId);
      if (link) {
        await revokeShareLink(profileId, link.id);
      }
      setActiveLink(null);
      setUrl(null);
    } catch {
      setError('Could not deactivate the share link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed. Select the link and copy it manually.');
    }
  }

  function shareWhatsApp() {
    if (!url) return;
    const text = encodeURIComponent(`${shareMessage}\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function shareEmail() {
    if (!url) return;
    const subject = encodeURIComponent('Consultant profile');
    const body = encodeURIComponent(`${shareMessage}\n\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function shareSMS() {
    if (!url) return;
    const text = encodeURIComponent(`${shareMessage} ${url}`);
    window.location.href = `sms:?body=${text}`;
  }

  // Loading state while checking for active link
  if (checkingActive) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/60">Checking share links...</span>
      </div>
    );
  }

  // Show share menu with URL (after creating a new link)
  if (url) {
    return (
      <div className="flex flex-col gap-3">
        {/* Link display */}
        <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-white/20 bg-[var(--color-bg-panel)] py-1 pl-4 pr-1">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
            aria-label="Share link"
          />
        </div>

        {/* Share options */}
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton onClick={copyLink} label={copied ? 'Copied' : 'Copy'} accent>
            <CopyIcon />
          </ShareButton>
          <ShareButton onClick={shareWhatsApp} label="WhatsApp">
            <WhatsAppIcon />
          </ShareButton>
          <ShareButton onClick={shareEmail} label="Email">
            <EmailIcon />
          </ShareButton>
          <ShareButton onClick={shareSMS} label="SMS">
            <SMSIcon />
          </ShareButton>
          <ShareButton onClick={deactivateFromUrl} label="Deactivate" danger>
            <DeactivateIcon />
          </ShareButton>
        </div>

        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
    );
  }

  // Show active link indicator with deactivate and create new options
  if (activeLink) {
    const createdDate = new Date(activeLink.createdAt);
    const daysAgo = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    const dateLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-green-900/30 px-3 py-1.5 text-xs font-semibold text-green-400">
            <ActiveIcon />
            Share link active
          </span>
          <span className="text-xs text-white/60">Created {dateLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="rounded-full border border-[var(--color-accent)] px-4 py-1.5 text-sm font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create new link'}
          </button>
          <button
            type="button"
            onClick={deactivate}
            disabled={loading}
            className="rounded-full border border-red-500/50 px-4 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            Deactivate
          </button>
        </div>

        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
    );
  }

  // No active link - show create button
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Share link'}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}

function ShareButton({
  onClick,
  label,
  accent,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  accent?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
        accent
          ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:brightness-95'
          : danger
            ? 'border border-red-500/50 text-red-400 hover:bg-red-500/10'
            : 'border border-white/20 text-white/80 hover:border-white/40 hover:text-white'
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function ActiveIcon() {
  return (
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function SMSIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function DeactivateIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}
