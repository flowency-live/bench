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
  emailGSI1PK,
  statusGSI2PK,
  tokenHashGSI3PK,
  validateTenantId,
} from './keys.js';

// Profile repository - implementation
export { createProfileRepository } from './repository/profile-repository.js';

// Re-export types from @bench/types (canonical contract)
export type {
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
