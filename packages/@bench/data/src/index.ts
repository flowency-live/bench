/**
 * @bench/data - DynamoDB data layer for Bench
 *
 * Provides:
 * - DynamoDB Document client factory
 * - Repository layer for tenant-scoped data access
 * - Key builders for tenant-prefixed keys
 *
 * Per ADR-0008: This replaces @bench/db (Postgres/RLS) with DynamoDB single-table
 * design and application-enforced tenant isolation.
 *
 * Tenant Isolation Model:
 * 1. Every item key carries the tenant (TENANT#{tenantId}#...)
 * 2. Repository is the ONLY path to the table - handlers never touch DynamoDB directly
 * 3. Every repository method takes tenantId as first argument
 * 4. The one global lookup is GSI3 (TOKENHASH#{hash}) for magic link validation
 */

// Client
export { createClient, getTableName, type ClientConfig } from './client.js';

// Key builders
export {
  tenantPK,
  tenantSK,
  profilePK,
  profileSK,
  userPK,
  userSK,
  magicLinkSK,
  skillSK,
  storySK,
  eventSK,
  clientPK,
  clientSK,
  contactSK,
  clientActivitySK,
  clientMagicLinkSK,
  emailGSI1PK,
  statusGSI2PK,
  tokenHashGSI3PK,
  validateTenantId,
} from './keys.js';

// Profile repository - implementation
export { createProfileRepository } from './repository/profile-repository.js';

// Tenant repository - implementation + extended types
export {
  createTenantRepository,
  type UpdateTenantPatch,
  type ExtendedTenantRepository,
} from './repository/tenant-repository.js';

// User repository - implementation
export { createUserRepository } from './repository/user-repository.js';

// Re-export types from @bench/types (canonical contract)
export type {
  // Profile types
  ProfileRepository,
  CreateConsultantInput,
  ProfilePatch,
  Profile,
  ProfileSummary,
  ProfileStatus,
  ProfilePositioning,
  ProfileSkill,
  ProfileStory,
  ProfileTestimonial,
  // Tenant types
  TenantRepository,
  CreateTenantInput,
  Tenant,
  TenantStatus,
  BrandTokens,
  // User types
  UserRepository,
  CreateTenantUserInput,
  TenantUser,
  TenantUserRole,
  TenantUserStatus,
} from '@bench/types';

// Magic link repository
export {
  createMagicLinkRepository,
  type MagicLinkRepository,
  type MagicLink,
  type MagicLinkLookup,
  type MagicLinkType,
  type MagicLinkScope,
  type MagicLinkStatus,
  type CreateMagicLinkInput,
} from './repository/magic-link-repository.js';

// OTP repository (ADR-0014: phone OTP for passwordless auth)
export {
  createOtpRepository,
  type OtpRepository,
  type OtpCreateResult,
} from './repository/otp-repository.js';

// Invite claim service (ADR-0014: decoupled claim / acceptInvite)
export {
  createInviteClaimService,
  type InviteClaimService,
  type AcceptInviteIdentity,
  type AcceptInviteResult,
} from './repository/invite-claim.js';

// Client repository (Client Portal feature)
export {
  createClientRepository,
  type ClientRepository,
} from './repository/client-repository.js';

// ClientContact repository (Client Portal feature)
export {
  createClientContactRepository,
  type ClientContactRepository,
} from './repository/client-contact-repository.js';

// ClientActivity repository (Client Portal feature)
export {
  createClientActivityRepository,
  type ClientActivityRepository,
  type ListActivityOptions,
} from './repository/client-activity-repository.js';

// Re-export client types from @bench/types
export type {
  Client,
  ClientContact,
  ClientActivity,
  ClientVisibilityMode,
  ClientActivityEventType,
  CreateClientInput,
  UpdateClientInput,
  CreateClientContactInput,
  UpdateClientContactInput,
  LogClientActivityInput,
} from '@bench/types';

// Portal link repository (Client Portal feature)
export {
  createPortalLinkRepository,
  type PortalLinkRepository,
  type PortalLink,
  type PortalLinkLookup,
  type PortalLinkStatus,
  type CreatePortalLinkInput,
} from './repository/portal-link-repository.js';
