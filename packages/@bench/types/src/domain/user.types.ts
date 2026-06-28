/**
 * Tenant user (portal owner/admin or viewer) — the control-plane identity.
 *
 * A `TenantUser` belongs to exactly one tenant and carries a role. Login resolves
 * a user globally by email (the GSI1 `EMAIL#{email}` lookup in DynamoDB) to
 * recover their tenant + role. Within a tenant, admins list/manage users.
 *
 * Auth model (ADR-0012): owners + platform admins authenticate via Cognito
 * (Google federation for godmode, email/password for owners); on claim the
 * Cognito identity is bound to this record via `cognitoId`. Consultants and
 * clients are NOT `TenantUser`s — they use link-scoped magic-link sessions
 * (ADR-0005) and have no account here.
 */

/** Tenant-scoped role (ADR-0010). `admin` manages; `viewer` is read-only. */
export type TenantUserRole = 'admin' | 'viewer';

/** Lifecycle of a tenant user. `pending` until they claim and activate. */
export type TenantUserStatus = 'pending' | 'active';

/** A portal user scoped to a single tenant. */
export interface TenantUser {
  readonly id: string;
  readonly tenantId: string;
  readonly email: string;
  readonly name?: string;
  readonly role: TenantUserRole;
  readonly status: TenantUserStatus;
  /**
   * Cognito identity bound to this user on claim (ADR-0012). `null`/absent until
   * the user completes Google federation or email/password sign-up. Used to link
   * a verified Cognito principal to this tenant-scoped record.
   */
  readonly cognitoId?: string | null;
  /** Email of the admin who invited this user (audit / display). */
  readonly invitedBy?: string;
  readonly createdAt: string;
}

/** Input for creating a tenant user; `tenantId` is supplied to the repo method. */
export interface CreateTenantUserInput {
  readonly email: string;
  readonly role: TenantUserRole;
  readonly name?: string;
  readonly invitedBy?: string;
}
