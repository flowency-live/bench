'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createConsultant } from '@/app/actions';
import type { FormState } from '@/lib/types';

const initial: FormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-black uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-95 disabled:opacity-60"
    >
      {pending ? 'Adding…' : 'Add to the Collective'}
    </button>
  );
}

const fieldClass =
  'w-full rounded-lg border border-white/15 bg-[var(--color-bg-primary)] px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-[var(--color-accent)]';
const labelClass =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]';

export function AddConsultantForm() {
  const [state, action] = useActionState(createConsultant, initial);

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="name" className={labelClass}>
          Full name
        </label>
        <input id="name" name="name" required placeholder="e.g. Priya Nair" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="name@example.com"
          className={fieldClass}
        />
        <p className="mt-1.5 text-xs text-white/40">
          We&rsquo;ll use this to send their invite link to complete the profile.
        </p>
      </div>
      <div>
        <label htmlFor="role" className={labelClass}>
          Role / strapline <span className="font-normal normal-case">(optional)</span>
        </label>
        <input
          id="role"
          name="role"
          placeholder="e.g. Change &amp; Transformation Lead"
          className={fieldClass}
        />
      </div>
      <SubmitButton />
    </form>
  );
}
