'use client';

import { useState } from 'react';

/**
 * Reusable "share a generated link" panel — a read-only link field plus
 * Copy / WhatsApp / Email / SMS actions. Generate-and-share, not auto-email-only.
 * Presentational and brand-token themed, so it works on tenant and godmode
 * surfaces alike.
 */
export function ShareLinkActions({
  url,
  shareMessage,
  subject,
}: {
  url: string;
  /** Leading line used in WhatsApp / Email / SMS bodies. */
  shareMessage: string;
  /** Email subject line. */
  subject: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed. Select the link and copy it manually.');
    }
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(`${shareMessage}\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function shareEmail() {
    const body = encodeURIComponent(`${shareMessage}\n\n${url}`);
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${body}`;
  }

  function shareSMS() {
    const text = encodeURIComponent(`${shareMessage} ${url}`);
    window.location.href = `sms:?body=${text}`;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-white/20 bg-[var(--color-bg-panel)] py-1 pl-4 pr-1">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
          aria-label="Invite link"
        />
      </div>

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
      </div>

      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}

function ShareButton({
  onClick,
  label,
  accent,
  children,
}: {
  onClick: () => void;
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
        accent
          ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] hover:brightness-95'
          : 'border border-white/20 text-white/80 hover:border-white/40 hover:text-white'
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
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
