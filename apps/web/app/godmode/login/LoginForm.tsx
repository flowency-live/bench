'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestPlatformLink, type PlatformLinkState } from './actions';

const initial: PlatformLinkState = { ok: false };

/** Same neutral confirmation regardless of whether the email is a platform admin. */
const NEUTRAL_CONFIRMATION =
  'If that email is a platform admin, a sign-in link is on its way.';

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
      <span>{pending ? 'Sending…' : 'Email me a godmode link'}</span>
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
  const [state, action] = useActionState(requestPlatformLink, initial);

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
            <p className="mb-2 text-[11px] font-semibold tracking-[0.1em] uppercase text-[#94a3b8]">
              Dev mode: no email service
            </p>
            <a
              href={state.devLink}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#baeb5b]
                         no-underline hover:opacity-85 hover:underline hover:underline-offset-4 transition-opacity"
            >
              Open godmode link
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {invalid && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-[10px] bg-red-600/[0.08] border border-red-600/20 text-[#fca5a5] text-[13px] leading-relaxed">
          <svg
            className="flex-shrink-0 mt-0.5 w-4 h-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>Sign-in failed. Please try again.</span>
        </div>
      )}

      {/* Google Sign-in (primary for godmode) */}
      <a
        href="/godmode/auth/google"
        className="login-btn group w-full flex items-center justify-center gap-3 px-6 py-4
                   rounded-full border-none font-extrabold text-[13px] uppercase tracking-[0.08em]
                   text-[#001930] cursor-pointer transition-all duration-200 no-underline"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span>Sign in with Google</span>
      </a>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#94a3b8]">
          or
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Magic link fallback */}
      <form action={action} className="flex flex-col gap-5">
        <div className="flex flex-col">
          <label
            htmlFor="email"
            className="mb-2 text-[11px] font-bold tracking-[0.12em] uppercase text-[#cbd5e1]"
          >
            Flowency email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@flowency.co.uk"
            className="login-input w-full px-4 py-3.5 rounded-[10px] border border-white/10
                       bg-[rgba(0,12,24,0.6)] text-[15px] text-white outline-none
                       placeholder:text-white/50
                       hover:border-white/[0.18] hover:bg-[rgba(0,12,24,0.8)]
                       focus:border-[rgba(186,235,91,0.5)] focus:bg-[rgba(0,12,24,0.9)]
                       focus:shadow-[0_0_0_3px_rgba(186,235,91,0.1)]
                       transition-all duration-200"
          />
        </div>

        <SubmitButton />
      </form>

      <p className="m-0 text-xs text-[#94a3b8] text-center leading-relaxed">
        Platform admins only. Flowency Google accounts or magic link.
      </p>
    </div>
  );
}
