'use client';

import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { createClient } from '@/app/clients/actions';
import type { Client, ClientVisibilityMode } from '@bench/types';

interface ClientFormProps {
  client?: Client;
  onUpdate?: (formData: FormData) => Promise<void>;
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Client'}
    </button>
  );
}

/**
 * Form for creating or editing a client.
 */
export function ClientForm({ client, onUpdate }: ClientFormProps) {
  const isEdit = !!client;

  async function handleSubmit(formData: FormData) {
    if (onUpdate) {
      await onUpdate(formData);
    } else {
      await createClient(formData);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Company Name */}
      <div>
        <label
          htmlFor="companyName"
          className="block text-sm font-semibold text-[var(--color-text-secondary)]"
        >
          Company Name
        </label>
        <input
          type="text"
          id="companyName"
          name="companyName"
          defaultValue={client?.companyName}
          required
          className="mt-2 block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          placeholder="Acme Corporation"
        />
      </div>

      {/* Visibility Mode */}
      <div>
        <label className="block text-sm font-semibold text-[var(--color-text-secondary)]">
          Consultant Visibility
        </label>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Which consultants can this client see in their portal?
        </p>
        <div className="mt-3 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20">
            <input
              type="radio"
              name="visibilityMode"
              value="all_active"
              defaultChecked={!client || client.visibilityMode === 'all_active'}
              className="mt-0.5 h-4 w-4 border-white/30 bg-transparent text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <div>
              <span className="font-semibold text-white">All active consultants</span>
              <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                Client can see all consultants with Active status
              </p>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20">
            <input
              type="radio"
              name="visibilityMode"
              value="handpicked"
              defaultChecked={client?.visibilityMode === 'handpicked'}
              className="mt-0.5 h-4 w-4 border-white/30 bg-transparent text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <div>
              <span className="font-semibold text-white">Hand-picked consultants</span>
              <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                Select specific consultants this client can see
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <Link
          href="/clients"
          className="text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-white"
        >
          Cancel
        </Link>
        <SubmitButton isEdit={isEdit} />
      </div>
    </form>
  );
}
