/**
 * Magic link types
 * - invite: Consultant editing their profile
 * - share: Client viewing a published profile
 */
export type MagicLinkType = 'invite' | 'share';

/**
 * Magic link status
 */
export type MagicLinkStatus = 'active' | 'used' | 'expired' | 'revoked';

/**
 * Magic link scope
 */
export type MagicLinkScope = 'edit' | 'view';

/**
 * Magic link entity (stored in DynamoDB)
 */
export interface MagicLink {
  readonly id: string;
  readonly profileId: string;
  readonly type: MagicLinkType;
  readonly tokenHash: string;
  readonly scope: MagicLinkScope;
  readonly status: MagicLinkStatus;
  readonly expiresAt: string;
  readonly passcodeHash: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Generated magic link token (raw + hash)
 */
export interface MagicLinkToken {
  readonly raw: string;
  readonly hash: string;
}

/**
 * Session payload for wizard (consultant editing)
 */
export interface WizardSessionPayload {
  readonly profileId: string;
  readonly scope: 'edit';
  readonly iat: number;
  readonly exp: number;
}

/**
 * Session payload for view (client viewing)
 */
export interface ViewSessionPayload {
  readonly profileId: string;
  readonly scope: 'view';
  readonly iat: number;
  readonly exp: number;
}

/**
 * Session payload for owner (authenticated user)
 */
export interface OwnerSessionPayload {
  readonly userId: string;
  readonly email: string;
  readonly consultancyId: string;
  readonly scope: 'admin';
  readonly iat: number;
  readonly exp: number;
}

/**
 * Union of all session payloads
 */
export type SessionPayload =
  | WizardSessionPayload
  | ViewSessionPayload
  | OwnerSessionPayload;
