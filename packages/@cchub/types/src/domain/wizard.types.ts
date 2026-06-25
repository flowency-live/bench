/**
 * Wizard step identifiers
 */
export type WizardStep =
  | 'identity'
  | 'positioning'
  | 'skills'
  | 'stories'
  | 'testimonial'
  | 'review';

/**
 * Wizard step completion status
 */
export interface WizardStepStatus {
  readonly step: WizardStep;
  readonly isComplete: boolean;
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

/**
 * Wizard state for a profile
 */
export interface WizardState {
  readonly profileId: string;
  readonly currentStep: WizardStep;
  readonly steps: readonly WizardStepStatus[];
  readonly canSubmit: boolean;
  readonly lastSavedAt: string | null;
}

/**
 * Identity step data
 */
export interface IdentityStepData {
  readonly consultantName: string;
  readonly role: string;
  readonly headshotAssetId: string | null;
}

/**
 * Positioning step data
 */
export interface PositioningStepData {
  readonly headline: string;
  readonly bio: string;
}

/**
 * Skills step data
 */
export interface SkillsStepData {
  readonly skills: readonly {
    readonly id: string;
    readonly title: string;
    readonly body: string;
    readonly order: number;
  }[];
}

/**
 * Stories step data
 */
export interface StoriesStepData {
  readonly stories: readonly {
    readonly id: string;
    readonly clientTag: string;
    readonly title: string;
    readonly body: string;
    readonly order: number;
  }[];
}

/**
 * Testimonial step data
 */
export interface TestimonialStepData {
  readonly hasTestimonial: boolean;
  readonly quote: string | null;
  readonly authorName: string | null;
  readonly authorRole: string | null;
  readonly authorCompany: string | null;
}

/**
 * Union of all step data types
 */
export type WizardStepData =
  | { step: 'identity'; data: IdentityStepData }
  | { step: 'positioning'; data: PositioningStepData }
  | { step: 'skills'; data: SkillsStepData }
  | { step: 'stories'; data: StoriesStepData }
  | { step: 'testimonial'; data: TestimonialStepData };
