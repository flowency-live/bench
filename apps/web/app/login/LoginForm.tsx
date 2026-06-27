'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestAdminLink, type AdminLinkState } from './actions';

const initial: AdminLinkState = { ok: false };

/** Same neutral confirmation regardless of whether the email is an admin. */
const NEUTRAL_CONFIRMATION =
  'If that email is registered as an admin, a sign-in link is on its way.';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="login-btn group w-full flex items-center justify-center gap-2.5 px-6 py-4
                 rounded-full border-none font-extrabold text-[13px] uppercase tracking-[0.08em]
                 text-[#001930] cursor-pointer transition-all duration-200
                 disabled:opacity-70 disabled:cursor-not-allowed"
    >
      <span>{pending ? 'Sending…' : 'Email me a sign-in link'}</span>
      {!pending && (
        <svg
          className="w-[18px] h-[18px] transition-transform duration-200 group-hover:translate-x-1"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}

export function LoginForm({ invalid }: { invalid?: boolean }) {
  const [state, action] = useActionState(requestAdminLink, initial);

  if (state.ok) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 mb-5 rounded-full bg-[rgba(186,235,91,0.12)] text-[#baeb5b]">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22,4 12,14.01 9,11.01" />
          </svg>
        </div>
        <p className="mb-6 text-[15px] leading-relaxed text-[#c8d8e8]">
          {NEUTRAL_CONFIRMATION}
        </p>

        {state.devLink && (
          <div className="p-4 rounded-xl bg-black/25 border border-white/[0.06]">
            <p className="mb-2 text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6a7a8a]">
              Dev mode — no email service
            </p>
            <a
              href={state.devLink}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#baeb5b]
                         no-underline hover:opacity-85 hover:underline hover:underline-offset-4 transition-opacity"
            >
              Open sign-in link
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      {invalid && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-[10px] bg-red-600/[0.08] border border-red-600/20 text-[#fca5a5] text-[13px] leading-relaxed">
          <svg
            className="flex-shrink-0 mt-0.5 w-4 h-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>That sign-in link is invalid or has expired. Request a new one below.</span>
        </div>
      )}

      <div className="flex flex-col">
        <label
          htmlFor="email"
          className="mb-2 text-[11px] font-bold tracking-[0.12em] uppercase text-[#8da0b8]"
        >
          Admin email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@changeconnected.co.uk"
          className="login-input w-full px-4 py-3.5 rounded-[10px] border border-white/10
                     bg-[rgba(0,12,24,0.6)] text-[15px] text-white outline-none
                     placeholder:text-white/25
                     hover:border-white/[0.18] hover:bg-[rgba(0,12,24,0.8)]
                     focus:border-[rgba(186,235,91,0.5)] focus:bg-[rgba(0,12,24,0.9)]
                     focus:shadow-[0_0_0_3px_rgba(186,235,91,0.1)]
                     transition-all duration-200"
        />
      </div>

      <SubmitButton />

      <p className="m-0 text-xs text-white/35 text-center leading-relaxed">
        We&rsquo;ll email a secure, single-use link — no password to remember.
      </p>
    </form>
  );
}
