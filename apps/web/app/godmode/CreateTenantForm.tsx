'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createTenant, type CreateTenantState } from './actions';

const initial: CreateTenantState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)] px-5 py-2.5
                 text-sm font-bold uppercase tracking-wide text-[var(--color-bg-primary)]
                 transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? 'Creating…' : 'Create tenant'}
    </button>
  );
}

/**
 * Godmode create-tenant form: company name + (optional) instance name +
 * first-admin email. On success surfaces the dev onboarding link for the new
 * admin (no email service in dev).
 */
export function CreateTenantForm() {
  const [state, action] = useActionState(createTenant, initial);

  return (
    <div className="rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
      <h2 className="text-lg font-black text-white">Create tenant</h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Provision a new customer org and invite its first admin.
      </p>

      {state.ok && state.tenantName ? (
        <div className="mt-5 rounded-lg border border-[rgba(186,235,91,0.25)] bg-[rgba(186,235,91,0.08)] p-4">
          <p className="text-sm font-semibold text-white">
            Created <span className="text-[var(--color-accent)]">{state.tenantName}</span>.
            An onboarding link has been issued for the first admin.
          </p>
          {state.devAdminLink && (
            <div className="mt-3 rounded-md bg-black/25 p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
                Dev mode: no email service
              </p>
              <a
                href={state.devAdminLink}
                className="text-sm font-semibold text-[var(--color-accent)] hover:underline hover:underline-offset-4"
              >
                Open admin onboarding link
              </a>
            </div>
          )}
        </div>
      ) : (
        <form action={action} className="mt-5 flex flex-col gap-4">
          {state.error && (
            <p className="rounded-md border border-red-600/20 bg-red-600/[0.08] px-3 py-2 text-sm text-[#fca5a5]">
              {state.error}
            </p>
          )}

          <Field
            id="name"
            label="Company name"
            placeholder="Acme Consulting"
            type="text"
            required
          />
          <Field
            id="instanceName"
            label="Instance name (optional)"
            placeholder="The Acme Hub"
            type="text"
          />
          <Field
            id="adminEmail"
            label="First-admin email"
            placeholder="admin@acme.com"
            type="email"
            required
          />

          <div className="pt-1">
            <SubmitButton />
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  placeholder,
  type,
  required,
}: {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'email';
  required?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        className="rounded-lg border border-white/10 bg-[rgba(0,12,24,0.6)] px-4 py-3 text-[15px] text-white
                   outline-none placeholder:text-white/40
                   focus:border-[rgba(186,235,91,0.5)] focus:shadow-[0_0_0_3px_rgba(186,235,91,0.1)]
                   transition"
      />
    </div>
  );
}
