'use client';

import { useState, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestAdminLink, type AdminLinkState } from './actions';
import { requestPhoneOtp, verifyPhoneOtp, type PhoneOtpState } from './phone-actions';

const magicLinkInitial: AdminLinkState = { ok: false };
const phoneOtpInitial: PhoneOtpState = { step: 'request', ok: false };

type AuthMethod = 'email' | 'phone' | 'socials';

/** Same neutral confirmation regardless of whether the email is an admin. */
const NEUTRAL_CONFIRMATION =
  'If that email is registered as an admin, a sign-in link is on its way.';

function MagicLinkButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="login-btn group w-full flex items-center justify-center gap-2.5 px-6 py-4
                 rounded-full border-none font-extrabold text-[13px] uppercase tracking-[0.08em]
                 text-white cursor-pointer transition-all duration-200
                 disabled:opacity-70 disabled:cursor-not-allowed"
    >
      <span>{pending ? 'Sending...' : 'Email me a sign-in link'}</span>
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

function SocialSignInPanel() {
  return (
    <div className="flex flex-col gap-4">
      <a
        href="/login/auth/google"
        className="group w-full flex items-center justify-center gap-3 px-6 py-4
                   rounded-full bg-white text-white font-semibold text-[14px]
                   no-underline transition-all duration-200
                   hover:bg-gray-100 hover:shadow-lg"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span>Continue with Google</span>
      </a>

      <a
        href="/login/auth/apple"
        className="group w-full flex items-center justify-center gap-3 px-6 py-4
                   rounded-full bg-black text-white font-semibold text-[14px]
                   no-underline transition-all duration-200
                   hover:bg-gray-900 hover:shadow-lg"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
        <span>Continue with Apple</span>
      </a>

      <p className="m-0 text-xs text-[#94a3b8] text-center leading-relaxed">
        Sign in with your existing social account. Fast and secure.
      </p>
    </div>
  );
}

function PhoneOtpButton({ step }: { step: 'request' | 'verify' }) {
  const { pending } = useFormStatus();
  const label = step === 'request'
    ? (pending ? 'Sending...' : 'Send code')
    : (pending ? 'Verifying...' : 'Verify code');

  return (
    <button
      type="submit"
      disabled={pending}
      className="login-btn group w-full flex items-center justify-center gap-2.5 px-6 py-4
                 rounded-full border-none font-extrabold text-[13px] uppercase tracking-[0.08em]
                 text-white cursor-pointer transition-all duration-200
                 disabled:opacity-70 disabled:cursor-not-allowed"
    >
      <span>{label}</span>
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

function PhoneOtpPanel() {
  const [state, action] = useActionState(
    (prev: PhoneOtpState, formData: FormData) => {
      if (prev.step === 'verify') {
        return verifyPhoneOtp(prev, formData);
      }
      return requestPhoneOtp(prev, formData);
    },
    phoneOtpInitial
  );

  // Verified successfully
  if (state.verified) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 mb-5 rounded-full bg-[rgba(133,112,235,0.12)] text-[#8570eb]">
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
          Code verified. Sign-in via phone will be available once your account has a phone number registered.
        </p>
      </div>
    );
  }

  // Verify step
  if (state.step === 'verify') {
    return (
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="phone" value={state.phone ?? ''} />

        <div className="text-center mb-2">
          <p className="text-sm text-[#c8d8e8]">
            Enter the 6-digit code sent to <span className="font-semibold">{state.phone}</span>
          </p>
        </div>

        {state.error && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-[10px] bg-red-600/[0.08] border border-red-600/20 text-[#fca5a5] text-[13px] leading-relaxed">
            <svg className="flex-shrink-0 mt-0.5 w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <span>{state.error}</span>
          </div>
        )}

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
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoComplete="one-time-code"
            placeholder="000000"
            className="login-input w-full px-4 py-3.5 rounded-[10px] border border-white/10
                       bg-[rgba(0,12,24,0.6)] text-[15px] text-white text-center tracking-[0.5em] font-mono outline-none
                       placeholder:text-white/50 placeholder:tracking-[0.5em]
                       hover:border-white/[0.18] hover:bg-[rgba(0,12,24,0.8)]
                       focus:border-[rgba(133,112,235,0.5)] focus:bg-[rgba(0,12,24,0.9)]
                       focus:shadow-[0_0_0_3px_rgba(133,112,235,0.1)]
                       transition-all duration-200"
          />
        </div>

        <PhoneOtpButton step="verify" />

        <p className="m-0 text-xs text-[#94a3b8] text-center leading-relaxed">
          Code expires in 5 minutes.
        </p>
      </form>
    );
  }

  // Request step
  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-[10px] bg-red-600/[0.08] border border-red-600/20 text-[#fca5a5] text-[13px] leading-relaxed">
          <svg className="flex-shrink-0 mt-0.5 w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex flex-col">
        <label
          htmlFor="phone"
          className="mb-2 text-[11px] font-bold tracking-[0.12em] uppercase text-[#cbd5e1]"
        >
          UK Mobile
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="07123 456789"
          className="login-input w-full px-4 py-3.5 rounded-[10px] border border-white/10
                     bg-[rgba(0,12,24,0.6)] text-[15px] text-white outline-none
                     placeholder:text-white/50
                     hover:border-white/[0.18] hover:bg-[rgba(0,12,24,0.8)]
                     focus:border-[rgba(133,112,235,0.5)] focus:bg-[rgba(0,12,24,0.9)]
                     focus:shadow-[0_0_0_3px_rgba(133,112,235,0.1)]
                     transition-all duration-200"
        />
      </div>

      <PhoneOtpButton step="request" />

      <p className="m-0 text-xs text-[#94a3b8] text-center leading-relaxed">
        We will text a 6-digit code to your phone.
      </p>
    </form>
  );
}

function AuthTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: AuthMethod;
  onTabChange: (tab: AuthMethod) => void;
}) {
  const tabs: { id: AuthMethod; label: string; icon: React.ReactNode }[] = [
    {
      id: 'email',
      label: 'Email',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M22 7l-10 5L2 7" />
        </svg>
      ),
    },
    {
      id: 'phone',
      label: 'Phone',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      ),
    },
    {
      id: 'socials',
      label: 'Socials',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex gap-1 p-1 mb-6 rounded-full bg-white/5" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full
                     text-[12px] font-semibold uppercase tracking-wider transition-all duration-200
                     ${
                       activeTab === tab.id
                         ? 'bg-[#8570eb] text-white'
                         : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                     }`}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Passwordless login form (ADR-0014).
 *
 * Tabbed interface supporting:
 * - Email magic link (active)
 * - Phone OTP (active)
 * - Social sign-in with Google/Apple (active)
 *
 * When `pendingEmail` is provided, the user clicked an invite link and must
 * verify their identity. The email field is pre-filled and messaging is
 * adjusted to guide them through identity verification.
 */
export function LoginForm({
  invalid,
  pendingEmail,
}: {
  invalid?: boolean;
  /** Email from pending invite (user must verify identity with this email). */
  pendingEmail?: string;
}) {
  const [activeTab, setActiveTab] = useState<AuthMethod>('email');
  const [state, action] = useActionState(requestAdminLink, magicLinkInitial);
  const hasPendingInvite = Boolean(pendingEmail);

  // Magic link sent confirmation
  if (state.ok) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 mb-5 rounded-full bg-[rgba(133,112,235,0.12)] text-[#8570eb]">
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
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#8570eb]
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
    <div className="flex flex-col gap-5">
      {/* Error messages */}
      {invalid && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-[10px] bg-red-600/[0.08] border border-red-600/20 text-[#fca5a5] text-[13px] leading-relaxed">
          <svg
            className="flex-shrink-0 mt-0.5 w-4 h-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>
            That sign-in link is invalid or has expired. Request a new one below.
          </span>
        </div>
      )}

      {/* Auth method tabs */}
      <AuthTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Email magic link panel */}
      {activeTab === 'email' && (
        <form action={action} className="flex flex-col gap-5">
          {hasPendingInvite && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-[10px] bg-[rgba(133,112,235,0.08)] border border-[rgba(133,112,235,0.2)] text-[#8570eb] text-[13px] leading-relaxed">
              <svg
                className="flex-shrink-0 mt-0.5 w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span>
                Verify your identity using <strong>{pendingEmail}</strong> to activate your account.
              </span>
            </div>
          )}

          <div className="flex flex-col">
            <label
              htmlFor="email"
              className="mb-2 text-[11px] font-bold tracking-[0.12em] uppercase text-[#cbd5e1]"
            >
              {hasPendingInvite ? 'Your email' : 'Admin email'}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={pendingEmail ?? ''}
              placeholder="you@yourcompany.com"
              className="login-input w-full px-4 py-3.5 rounded-[10px] border border-white/10
                         bg-[rgba(0,12,24,0.6)] text-[15px] text-white outline-none
                         placeholder:text-white/50
                         hover:border-white/[0.18] hover:bg-[rgba(0,12,24,0.8)]
                         focus:border-[rgba(133,112,235,0.5)] focus:bg-[rgba(0,12,24,0.9)]
                         focus:shadow-[0_0_0_3px_rgba(133,112,235,0.1)]
                         transition-all duration-200"
            />
          </div>

          <MagicLinkButton />

          <p className="m-0 text-xs text-[#94a3b8] text-center leading-relaxed">
            {hasPendingInvite
              ? 'We will send a verification link to confirm your identity.'
              : 'We will email a secure, single-use link. No password to remember.'}
          </p>
        </form>
      )}

      {/* Phone OTP panel */}
      {activeTab === 'phone' && <PhoneOtpPanel />}

      {/* Social sign-in panel */}
      {activeTab === 'socials' && <SocialSignInPanel />}
    </div>
  );
}
