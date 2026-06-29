'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Tenant } from '@/lib/data/tenant';
import type { TenantUser } from '@/lib/data/user';
import {
  switchTenant,
  setTenantStatus,
  deleteTenant,
  removeTenantUser,
  setTenantUserRole,
} from './actions';
import { GodmodeBrandPanel } from './GodmodeBrandPanel';
import { AdminInviteButton } from './AdminInviteButton';

/**
 * Wrap a server action that returns state into a void-returning action.
 * Next.js 15 form actions expect `(formData: FormData) => void | Promise<void>`,
 * but our actions return `Promise<TenantActionState>` for error handling.
 * This wrapper ignores the return value for form submission compatibility.
 */
function asFormAction<T>(
  action: (formData: FormData) => Promise<T>,
): (formData: FormData) => Promise<void> {
  return async (formData: FormData) => {
    await action(formData);
  };
}

/**
 * Per-tenant control row for the godmode dashboard (ADR-0010 §control-plane).
 *
 * Suspend/reactivate (status toggle), manage admins (expandable: list users
 * with role toggle + remove), and delete (type-to-confirm disclosure). Delete is
 * the only destructive surface and uses a red accent; everything else stays on
 * the navy/lime brand. No position:fixed — every panel is inline disclosure.
 */
export function TenantRow({
  tenant,
  users,
}: {
  tenant: Tenant;
  users: readonly TenantUser[];
}) {
  const [panel, setPanel] = useState<'none' | 'admins' | 'branding' | 'delete'>('none');
  const suspended = tenant.status === 'suspended';

  const toggle = (next: 'admins' | 'branding' | 'delete') =>
    setPanel((p) => (p === next ? 'none' : next));

  return (
    <li className="rounded-xl border border-white/10 bg-[var(--color-bg-panel)]">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-white">
            {tenant.name}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            {tenant.instanceName} · {tenant.id}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              suspended
                ? 'rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-red-300'
                : 'rounded-full bg-[rgba(207,132,96,0.14)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent)]'
            }
          >
            {tenant.status}
          </span>

          {/* Suspend / Reactivate */}
          <form action={asFormAction(setTenantStatus)}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <input
              type="hidden"
              name="status"
              value={suspended ? 'active' : 'suspended'}
            />
            <PlainButton>{suspended ? 'Reactivate' : 'Suspend'}</PlainButton>
          </form>

          {/* Manage admins */}
          <button
            type="button"
            onClick={() => toggle('admins')}
            aria-expanded={panel === 'admins'}
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:text-white"
          >
            Manage admins ({users.length})
          </button>

          {/* Branding */}
          <button
            type="button"
            onClick={() => toggle('branding')}
            aria-expanded={panel === 'branding'}
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:text-white"
          >
            Branding
          </button>

          {/* Switch in (preserved) */}
          <form action={switchTenant}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <button
              type="submit"
              className="rounded-full border border-[var(--color-accent)] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
            >
              Switch in →
            </button>
          </form>

          {/* Delete (destructive — red accent) */}
          <button
            type="button"
            onClick={() => toggle('delete')}
            aria-expanded={panel === 'delete'}
            className="rounded-full border border-red-500/40 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-red-300 transition hover:border-red-400 hover:bg-red-500/10 hover:text-red-200"
          >
            Delete
          </button>
        </div>
      </div>

      {panel === 'admins' && (
        <ManageAdmins tenant={tenant} users={users} />
      )}
      {panel === 'branding' && <GodmodeBrandPanel tenant={tenant} />}
      {panel === 'delete' && <DeleteConfirm tenant={tenant} />}
    </li>
  );
}

function ManageAdmins({
  tenant,
  users,
}: {
  tenant: Tenant;
  users: readonly TenantUser[];
}) {
  return (
    <div className="border-t border-white/10 px-5 py-4">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
        Users in {tenant.name}
      </p>
      {users.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No users in this tenant yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-col gap-2 rounded-lg border border-white/10 bg-[rgba(0,12,24,0.4)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {user.name ? `${user.name} · ` : ''}
                  {user.email}
                </p>
                <p className="mt-0.5 text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                  {user.role} · {user.status}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Role toggle */}
                <form action={asFormAction(setTenantUserRole)}>
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input type="hidden" name="userId" value={user.id} />
                  <input
                    type="hidden"
                    name="role"
                    value={user.role === 'admin' ? 'viewer' : 'admin'}
                  />
                  <PlainButton>
                    {user.role === 'admin' ? 'Make viewer' : 'Make admin'}
                  </PlainButton>
                </form>

                {/* Remove user */}
                <form action={asFormAction(removeTenantUser)}>
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-red-500/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-red-300 transition hover:border-red-400 hover:bg-red-500/10 hover:text-red-200"
                  >
                    Remove
                  </button>
                </form>
              </div>
              </div>

              {/* (Re)issue this admin's onboarding / sign-in link (ISS-1). */}
              {user.role === 'admin' && (
                <AdminInviteButton
                  tenantId={tenant.id}
                  userId={user.id}
                  email={user.email}
                  status={user.status === 'active' ? 'active' : 'pending'}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-[var(--color-text-secondary)]">
        The last active admin of a tenant cannot be removed.
      </p>
    </div>
  );
}

function DeleteConfirm({ tenant }: { tenant: Tenant }) {
  const [confirmName, setConfirmName] = useState('');
  const matches = confirmName.trim() === tenant.name;

  return (
    <div className="border-t border-red-500/20 bg-red-500/[0.04] px-5 py-4">
      <p className="text-sm font-black text-red-200">Delete {tenant.name}?</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
        This permanently removes the tenant and all of its users. This cannot be
        undone. Type the tenant name to confirm.
      </p>
      <form action={asFormAction(deleteTenant)} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="tenantId" value={tenant.id} />
        <div className="flex flex-col">
          <label
            htmlFor={`confirm-${tenant.id}`}
            className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]"
          >
            Type {tenant.name}
          </label>
          <input
            id={`confirm-${tenant.id}`}
            name="confirmName"
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            autoComplete="off"
            placeholder={tenant.name}
            className="rounded-lg border border-white/10 bg-[rgba(0,12,24,0.6)] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-red-400/60 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.12)] transition"
          />
        </div>
        <button
          type="submit"
          disabled={!matches}
          className="rounded-full border border-red-500 bg-red-500/90 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Delete tenant
        </button>
      </form>
    </div>
  );
}

/** A neutral, on-brand action button that reflects its form's pending state. */
function PlainButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
