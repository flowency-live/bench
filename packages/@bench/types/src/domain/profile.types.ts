/**
 * Profile status state machine
 * Draft → Invited → In Progress → Submitted → Published → Archived
 */
export type ProfileStatus =
  | 'draft'
  | 'invited'
  | 'in_progress'
  | 'submitted'
  | 'published'
  | 'archived';

/**
 * Positioning section of a profile
 */
export interface ProfilePositioning {
  readonly headline: string;
  readonly bio: string;
}

/**
 * Skill item (3-6 per profile)
 */
export interface ProfileSkill {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly order: number;
}

/**
 * Impact story item (3-5 per profile)
 */
export interface ProfileStory {
  readonly id: string;
  readonly clientTag: string;
  readonly title: string;
  readonly body: string;
  readonly order: number;
}

/**
 * Testimonial (optional)
 */
export interface ProfileTestimonial {
  readonly id: string;
  readonly quote: string;
  readonly authorName: string;
  readonly authorRole: string;
  readonly authorCompany: string;
}

/**
 * Complete profile entity
 */
export interface Profile {
  readonly id: string;
  readonly tenantId: string;
  readonly consultantName: string;
  readonly consultantEmail: string;
  readonly role: string | null;
  readonly status: ProfileStatus;
  readonly positioning: ProfilePositioning | null;
  readonly headshotAssetId: string | null;
  readonly skills: readonly ProfileSkill[];
  readonly stories: readonly ProfileStory[];
  readonly testimonial: ProfileTestimonial | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submittedAt: string | null;
  readonly publishedAt: string | null;
  readonly archivedAt: string | null;
}

/**
 * Minimal profile for roster display
 */
export interface ProfileSummary {
  readonly id: string;
  readonly tenantId: string;
  readonly consultantName: string;
  readonly role: string | null;
  readonly status: ProfileStatus;
  readonly headshotUrl: string | null;
  readonly updatedAt: string;
}
