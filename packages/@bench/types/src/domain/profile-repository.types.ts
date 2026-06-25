/**
 * ProfileRepository — the canonical data-access contract.
 *
 * Published here so `@bench/data` (implementation) and `apps/web` (consumer)
 * share ONE contract. Tenant-scoped (tenantId first); the repository is the only
 * path to the table (ADR-0008). See `_documentation/data-contract.md`.
 */
import type {
  Profile,
  ProfilePositioning,
  ProfileSkill,
  ProfileStatus,
  ProfileStory,
  ProfileSummary,
  ProfileTestimonial,
} from './profile.types';

export interface CreateConsultantInput {
  readonly consultantName: string;
  readonly consultantEmail: string;
  readonly role?: string;
}

export interface ProfilePatch {
  readonly consultantName?: string;
  readonly role?: string | null;
  readonly positioning?: ProfilePositioning | null;
  readonly headshotAssetId?: string | null;
  readonly skills?: readonly ProfileSkill[];
  readonly stories?: readonly ProfileStory[];
  readonly testimonial?: ProfileTestimonial | null;
}

export interface ProfileRepository {
  /** All profiles for the tenant (summary rows). */
  list(tenantId: string): Promise<readonly ProfileSummary[]>;
  /** A full profile incl. skills/stories/testimonial, or null. */
  get(tenantId: string, profileId: string): Promise<Profile | null>;
  /** Create a Draft from name + email. */
  create(tenantId: string, input: CreateConsultantInput): Promise<Profile>;
  /** Apply wizard edits; replaces child collections present in the patch. */
  update(tenantId: string, profileId: string, patch: ProfilePatch): Promise<Profile>;
  /** Lifecycle transition; stamps the matching timestamp. */
  setStatus(tenantId: string, profileId: string, status: ProfileStatus): Promise<Profile>;
}
