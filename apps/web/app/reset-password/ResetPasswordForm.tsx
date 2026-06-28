'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { completePasswordReset, type ResetPasswordState } from './actions';

const initial: ResetPasswordState = { ok: false };

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
      <span>{pending ? 'Resetting…' : 'Reset password'}</span>
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

export function ResetPasswordForm({ email: initialEmail }: { email?: string }) {
  const [state, action] = useActionState(completePasswordReset, initial);

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-[10px] bg-red-600/[0.08] border border-red-600/20 text-[#fca5a5] text-[13px] leading-relaxed">
          <svg
            className="flex-shrink-0 mt-0.5 w-4 h-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex flex-col">
        <label
          htmlFor="email"
          className="mb-2 text-[11px] font-bold tracking-[0.12em] uppercase text-[#cbd5e1]"
        >
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={initialEmail}
          placeholder="you@changeconnected.co.uk"
          className="login-input w-full px-4 py-3.5 rounded-[10px] border border-white/10
                     bg-[rgba(0,12,24,0.6)] text-[15px] text-white outline-none
                     placeholder:text-white/50
                     hover:border-white/[0.18] hover:bg-[rgba(0,12,24,0.8)]
                     focus:border-[rgba(186,235,91,0.5)] focus:bg-[rgba(0,12,24,0.9)]
                     focus:shadow-[0_0_0_3px_rgba(186,235,91,0.1)]
                     transition-all duration-200"
        />
      </div>

      <div className="flex flex-col">
        <label
          htmlFor="code"
          className="mb-2 text-[11px] font-bold tracking-[0.12em] uppercase text-[#cbd5e1]"
        >
          Verification code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="Enter 6-digit code"
          className="login-input w-full px-4 py-3.5 rounded-[10px] border border-white/10
                     bg-[rgba(0,12,24,0.6)] text-[15px] text-white outline-none
                     placeholder:text-white/50 tracking-[0.2em] text-center
                     hover:border-white/[0.18] hover:bg-[rgba(0,12,24,0.8)]
                     focus:border-[rgba(186,235,91,0.5)] focus:bg-[rgba(0,12,24,0.9)]
                     focus:shadow-[0_0_0_3px_rgba(186,235,91,0.1)]
                     transition-all duration-200"
        />
      </div>

      <div className="flex flex-col">
        <label
          htmlFor="password"
          className="mb-2 text-[11px] font-bold tracking-[0.12em] uppercase text-[#cbd5e1]"
        >
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="login-input w-full px-4 py-3.5 rounded-[10px] border border-white/10
                     bg-[rgba(0,12,24,0.6)] text-[15px] text-white outline-none
                     placeholder:text-white/50
                     hover:border-white/[0.18] hover:bg-[rgba(0,12,24,0.8)]
                     focus:border-[rgba(186,235,91,0.5)] focus:bg-[rgba(0,12,24,0.9)]
                     focus:shadow-[0_0_0_3px_rgba(186,235,91,0.1)]
                     transition-all duration-200"
        />
      </div>

      <div className="flex flex-col">
        <label
          htmlFor="confirmPassword"
          className="mb-2 text-[11px] font-bold tracking-[0.12em] uppercase text-[#cbd5e1]"
        >
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Re-enter your password"
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

      <p className="text-center text-xs text-[#94a3b8]">
        Password must be at least 8 characters with uppercase, lowercase, and numbers.
      </p>

      <a
        href="/forgot-password"
        className="text-xs text-[#94a3b8] hover:text-white transition-colors text-center"
      >
        Request a new code
      </a>
    </form>
  );
}
