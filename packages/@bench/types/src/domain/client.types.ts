/**
 * Client (external company) and ClientContact (person at that company) types.
 *
 * Clients are tenant-scoped companies who can access the consultant collective
 * via a dedicated portal. Each client has one or more contacts who receive
 * magic links to access the portal.
 *
 * Visibility rules:
 * - `all_active`: Client sees all consultants with status='active'
 * - `handpicked`: Client sees only specific consultants chosen by tenant admin
 */

/** How a client's visibility into the collective is determined. */
export type ClientVisibilityMode = 'all_active' | 'handpicked';

/** A client company scoped to a single tenant. */
export interface Client {
  readonly id: string;
  readonly tenantId: string;
  readonly companyName: string;
  /** Determines which profiles this client can see. */
  readonly visibilityMode: ClientVisibilityMode;
  /** Profile IDs visible to this client (only when visibilityMode='handpicked'). */
  readonly handpickedProfileIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Email of the admin who created this client. */
  readonly createdBy: string;
}

/** Input for creating a client; `tenantId` is supplied to the repo method. */
export interface CreateClientInput {
  readonly companyName: string;
  readonly visibilityMode: ClientVisibilityMode;
  readonly handpickedProfileIds?: readonly string[];
  readonly createdBy: string;
}

/** Input for updating a client. */
export interface UpdateClientInput {
  readonly companyName?: string;
  readonly visibilityMode?: ClientVisibilityMode;
  readonly handpickedProfileIds?: readonly string[];
}

/** A contact person at a client company who can access the portal. */
export interface ClientContact {
  readonly id: string;
  readonly tenantId: string;
  readonly clientId: string;
  readonly email: string;
  readonly name: string;
  /** ISO timestamp of last portal login (null if never logged in). */
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Input for creating a client contact. */
export interface CreateClientContactInput {
  readonly email: string;
  readonly name: string;
}

/** Input for updating a client contact. */
export interface UpdateClientContactInput {
  readonly email?: string;
  readonly name?: string;
}

/** Type of activity event logged for a client. */
export type ClientActivityEventType = 'view' | 'export';

/** An activity event tracking client interactions with profiles. */
export interface ClientActivity {
  readonly id: string;
  readonly tenantId: string;
  readonly clientId: string;
  readonly contactId: string;
  readonly contactEmail: string;
  readonly profileId: string;
  readonly eventType: ClientActivityEventType;
  readonly createdAt: string;
}

/** Input for logging a client activity event. */
export interface LogClientActivityInput {
  readonly clientId: string;
  readonly contactId: string;
  readonly contactEmail: string;
  readonly profileId: string;
  readonly eventType: ClientActivityEventType;
}
