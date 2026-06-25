import type { Profile, ProfileSummary } from '../domain/profile.types';
import type { MagicLink } from '../domain/magic-link.types';
import type { WizardState } from '../domain/wizard.types';
import type { AuditEventSummary } from '../domain/event.types';

/**
 * API success response wrapper
 */
export interface ApiResponse<T> {
  readonly success: true;
  readonly data: T;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
}

/**
 * Roster dashboard response
 */
export interface RosterResponse {
  readonly profiles: readonly ProfileSummary[];
  readonly total: number;
}

/**
 * Profile detail response
 */
export interface ProfileResponse {
  readonly profile: Profile;
  readonly inviteLinks: readonly MagicLink[];
  readonly shareLinks: readonly MagicLink[];
  readonly events: readonly AuditEventSummary[];
}

/**
 * Create profile response
 */
export interface CreateProfileResponse {
  readonly profile: Profile;
}

/**
 * Generate link response
 */
export interface GenerateLinkResponse {
  readonly link: MagicLink;
  readonly url: string;
}

/**
 * Validate link response
 */
export interface ValidateLinkResponse {
  readonly valid: boolean;
  readonly reason?: 'expired' | 'revoked' | 'not_found' | 'invalid_passcode';
  readonly profileId?: string;
  readonly scope?: 'edit' | 'view';
}

/**
 * Wizard state response
 */
export interface WizardStateResponse {
  readonly state: WizardState;
  readonly profile: Profile;
}

/**
 * Upload URL response
 */
export interface UploadUrlResponse {
  readonly uploadUrl: string;
  readonly assetId: string;
  readonly expiresAt: string;
}
