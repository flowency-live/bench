'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestAdminLink, type AdminLinkState } from './actions';

const initial: AdminLinkState = { ok: false };

/** Same neutral confirmation regardless of whether the email is an admin. */
const NEUTRAL_CONFIRMATION =
  'If that email is registered as an admin, a sign-in link is on its way.';

const fieldClass =
  'w-full rounded-lg border border-white/15 bg-[var(--color-bg-primary)] px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-[var(--color-accent)]';
const labelClass =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-black uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-95 disabled:opacity-60"
    >
      {pending ? 'Sending…' : 'Email me a sign-in link'}
    </button>
  );
}

export function LoginForm({ invalid }: { invalid?: boolean }) {
  const [state, action] = useActionState(requestAdminLink, initial);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-sm text-white">
          {NEUTRAL_CONFIRMATION}
        </p>

        {state.devLink && (
          <div className="rounded-lg border border-white/15 bg-[var(--color-bg-primary)] px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Dev mode — no email service
            </p>
            <a
              href={state.devLink}
              className="break-all text-sm font-semibold text-[var(--color-accent)] underline underline-offset-2 hover:brightness-110"
            >
              Dev sign-in link
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {invalid && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          That sign-in link is invalid or has expired. Request a new one below.
        </p>
      )}
      <div>
        <label htmlFor="email" className={labelClass}>
          Admin email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@changeconnected.co.uk"
          className={fieldClass}
        />
      </div>
      <SubmitButton />
      <p className="text-xs text-white/40">
        We&rsquo;ll email a secure, single-use link — no password to remember.
      </p>
    </form>
  );
}
