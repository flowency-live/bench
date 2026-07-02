'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

const errorMessages: Record<string, { title: string; description: string }> = {
  missing_token: {
    title: 'Invalid Link',
    description: 'This portal link appears to be incomplete. Please request a new link from your contact.',
  },
  not_found: {
    title: 'Link Not Found',
    description: 'This portal link could not be found. It may have been revoked or never existed.',
  },
  already_used: {
    title: 'Link Already Used',
    description:
      'This portal link has already been used. For security, each link can only be used once. Please request a new link.',
  },
  expired: {
    title: 'Link Expired',
    description:
      'This portal link has expired. Links are valid for 7 days. Please request a new link from your contact.',
  },
  invalid: {
    title: 'Invalid Link',
    description: 'This portal link is no longer valid. Please request a new link from your contact.',
  },
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') ?? 'invalid';

  const error = errorMessages[reason] ?? errorMessages.invalid!;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg-primary)] px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
            <svg
              className="h-8 w-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        <h1 className="mb-3 text-2xl font-bold text-white">{error.title}</h1>
        <p className="mb-8 text-[var(--color-text-secondary)]">{error.description}</p>

        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Need help? Contact the person who sent you this link.
          </p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-white/10 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PortalErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)]">
          <p className="text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
