import type { WizardStepData } from '../domain/wizard.types';

/**
 * Create profile request
 */
export interface CreateProfileRequest {
  readonly consultantName: string;
  readonly consultantEmail: string;
  readonly role?: string;
}

/**
 * Update profile request
 */
export interface UpdateProfileRequest {
  readonly consultantName?: string;
  readonly consultantEmail?: string;
  readonly role?: string;
}

/**
 * Generate invite link request
 */
export interface GenerateInviteLinkRequest {
  readonly profileId: string;
  readonly expiresInDays?: number;
}

/**
 * Generate share link request
 */
export interface GenerateShareLinkRequest {
  readonly profileId: string;
  readonly expiresInDays: number | null;
  readonly passcode?: string;
}

/**
 * Validate magic link request
 */
export interface ValidateMagicLinkRequest {
  readonly token: string;
  readonly passcode?: string;
}

/**
 * Save wizard step request
 */
export interface SaveWizardStepRequest {
  readonly profileId: string;
  readonly stepData: WizardStepData;
}

/**
 * Submit wizard request
 */
export interface SubmitWizardRequest {
  readonly profileId: string;
}

/**
 * Upload asset request
 */
export interface RequestUploadUrlRequest {
  readonly profileId: string;
  readonly contentType: string;
  readonly filename: string;
}
