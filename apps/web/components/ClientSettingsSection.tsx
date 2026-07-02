'use client';

import { useFormStatus } from 'react-dom';
import { updateClient, deleteClient } from '@/app/clients/actions';
import type { Client } from '@bench/types';

interface Props {
  client: Client;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-bold text-[var(--color-bg-primary)] transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Saving...' : 'Save Changes'}
    </button>
  );
}

/**
 * Section for client settings and danger zone.
 */
export function ClientSettingsSection({ client }: Props) {
  async function handleUpdate(formData: FormData) {
    await updateClient(client.id, formData);
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${client.companyName}"? This will remove all contacts and activity history. This action cannot be undone.`,
      )
    ) {
      return;
    }
    await deleteClient(client.id);
  }

  return (
    <div className="space-y-8">
      {/* Settings */}
      <div>
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Configure access and visibility settings
        </p>

        <form action={handleUpdate} className="mt-4 space-y-6">
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
              defaultValue={client.companyName}
              required
              className="mt-2 block w-full max-w-md rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Visibility Mode */}
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-secondary)]">
              Consultant Visibility
            </label>
            <div className="mt-3 space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20">
                <input
                  type="radio"
                  name="visibilityMode"
                  value="all_active"
                  defaultChecked={client.visibilityMode === 'all_active'}
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
                  defaultChecked={client.visibilityMode === 'handpicked'}
                  className="mt-0.5 h-4 w-4 border-white/30 bg-transparent text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                />
                <div>
                  <span className="font-semibold text-white">Hand-picked consultants</span>
                  <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                    Select specific consultants this client can see
                  </p>
                  {client.visibilityMode === 'handpicked' && (
                    <p className="mt-2 text-xs text-[var(--color-accent)]">
                      {client.handpickedProfileIds.length} consultant(s) selected
                    </p>
                  )}
                </div>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <SaveButton />
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
        <h3 className="text-lg font-bold text-red-400">Danger Zone</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Deleting this client will remove all contacts and activity history. Portal links will
          stop working.
        </p>
        <button
          onClick={handleDelete}
          className="mt-4 rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500 hover:text-white"
        >
          Delete Client
        </button>
      </div>
    </div>
  );
}
