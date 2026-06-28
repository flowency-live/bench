'use client';

import { useActionState } from 'react';
import { completeClaim, type ClaimState } from './actions';

const initialState: ClaimState = { ok: false };

export function ClaimForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(completeClaim, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      {/* Email display (read-only) */}
      <div className="flex flex-col">
        <label
          htmlFor="email"
          className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          readOnly
          disabled
          className="w-full rounded-[10px] border border-white/10 bg-[rgba(0,12,24,0.4)] px-4 py-3 text-sm text-white/60 outline-none"
        />
      </div>

      {/* Password */}
      <div className="flex flex-col">
        <label
          htmlFor="password"
          className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="w-full rounded-[10px] border border-white/10 bg-[rgba(0,12,24,0.6)] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 transition-all hover:border-white/20 focus:border-[rgba(186,235,91,0.5)] focus:bg-[rgba(0,12,24,0.9)] focus:shadow-[0_0_0_3px_rgba(186,235,91,0.1)]"
        />
      </div>

      {/* Confirm Password */}
      <div className="flex flex-col">
        <label
          htmlFor="confirmPassword"
          className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]"
        >
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          className="w-full rounded-[10px] border border-white/10 bg-[rgba(0,12,24,0.6)] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 transition-all hover:border-white/20 focus:border-[rgba(186,235,91,0.5)] focus:bg-[rgba(0,12,24,0.9)] focus:shadow-[0_0_0_3px_rgba(186,235,91,0.1)]"
        />
      </div>

      {/* Error message */}
      {state.error && (
        <div className="flex items-start gap-3 rounded-[10px] border border-red-600/20 bg-red-600/[0.08] px-4 py-3 text-[13px] text-[#fca5a5]">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>{state.error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full rounded-full bg-[var(--color-accent)] py-3 text-sm font-black uppercase tracking-wide text-[var(--color-bg-primary)] transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-center text-xs text-[var(--color-text-secondary)]">
        Password must be at least 8 characters with uppercase, lowercase, and numbers.
      </p>
    </form>
  );
}
