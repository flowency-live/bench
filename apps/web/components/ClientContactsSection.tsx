'use client';

import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import { addContact, removeContact, sendPortalLink } from '@/app/clients/actions';
import type { ClientContact } from '@bench/types';

interface Props {
  clientId: string;
  contacts: readonly ClientContact[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-bold text-[var(--color-bg-primary)] transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Adding...' : 'Add Contact'}
    </button>
  );
}

/**
 * Section for managing contacts at a client company.
 */
export function ClientContactsSection({ clientId, contacts }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [sendingLinkFor, setSendingLinkFor] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function handleAddContact(formData: FormData) {
    await addContact(clientId, formData);
    setShowForm(false);
  }

  async function handleRemoveContact(contactId: string) {
    if (!confirm('Remove this contact? They will no longer be able to access the portal.')) {
      return;
    }
    await removeContact(clientId, contactId);
  }

  async function handleSendLink(contactId: string) {
    setSendingLinkFor(contactId);
    setDevToken(null);
    try {
      const result = await sendPortalLink(clientId, contactId);
      if (result.success) {
        if (result.devToken) {
          setDevToken(result.devToken);
        } else {
          alert('Portal link sent successfully.');
        }
      } else {
        alert(`Failed to send link: ${result.error}`);
      }
    } finally {
      setSendingLinkFor(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Contacts</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            People at this company who can access the Client Portal
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg border border-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
          >
            + Add Contact
          </button>
        )}
      </div>

      {/* Dev Token Display */}
      {devToken && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-400">
            Dev Mode: Portal Link Generated
          </p>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            Copy this link to test the portal:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-black/30 px-3 py-2 text-xs text-white break-all">
              {typeof window !== 'undefined' ? window.location.origin : ''}/portal/auth/{devToken}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/portal/auth/${devToken}`,
                );
              }}
              className="rounded bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/30"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setDevToken(null)}
            className="mt-2 text-xs text-amber-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add Contact Form */}
      {showForm && (
        <form
          action={handleAddContact}
          className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-[var(--color-text-secondary)]"
              >
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="mt-1 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[var(--color-accent)] focus:outline-none"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-[var(--color-text-secondary)]"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="mt-1 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[var(--color-accent)] focus:outline-none"
                placeholder="john@company.com"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-white"
            >
              Cancel
            </button>
            <SubmitButton />
          </div>
        </form>
      )}

      {/* Contacts List */}
      {contacts.length === 0 && !showForm ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
          <p className="text-[var(--color-text-secondary)]">No contacts yet.</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Add a contact to send them a portal link.
          </p>
        </div>
      ) : contacts.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">Name</th>
                <th className="hidden px-4 py-3 font-semibold text-[var(--color-text-secondary)] sm:table-cell">
                  Email
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">
                  Last Login
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {contacts.map((contact) => (
                <tr key={contact.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-white">{contact.name}</span>
                    <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)] sm:hidden">
                      {contact.email}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--color-text-secondary)] sm:table-cell">
                    {contact.email}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {contact.lastLoginAt
                      ? new Date(contact.lastLoginAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleSendLink(contact.id)}
                        disabled={sendingLinkFor === contact.id}
                        className="text-sm font-semibold text-[var(--color-accent)] transition hover:underline disabled:opacity-50"
                      >
                        {sendingLinkFor === contact.id ? 'Sending...' : 'Send Link'}
                      </button>
                      <button
                        onClick={() => handleRemoveContact(contact.id)}
                        className="text-sm font-semibold text-red-400 transition hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
