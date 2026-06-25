/**
 * UI view types for the Bench portal.
 *
 * These mirror `@bench/types` (domain) but are kept local so the web app runs
 * without depending on other workspace packages being built. When `@bench/data`
 * lands, map its records to these shapes (or replace these with `@bench/types`
 * imports once the package build/transpile path is settled).
 */

export type ProfileStatus =
  | 'draft'
  | 'invited'
  | 'in_progress'
  | 'submitted'
  | 'published'
  | 'archived';

export interface Skill {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly order: number;
}

export interface Story {
  readonly id: string;
  readonly clientTag: string;
  readonly title: string;
  readonly body: string;
  readonly order: number;
}

export interface Testimonial {
  readonly quote: string;
  readonly authorName: string;
  readonly authorRole: string;
  readonly authorCompany: string;
}

export interface Profile {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly email: string;
  readonly role: string | null;
  readonly status: ProfileStatus;
  readonly headline: string | null;
  readonly bio: string | null;
  readonly headshotUrl: string | null;
  readonly skills: readonly Skill[];
  readonly stories: readonly Story[];
  readonly testimonial: Testimonial | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Lightweight row for the Collective Dashboard list. */
export interface ProfileSummary {
  readonly id: string;
  readonly name: string;
  readonly role: string | null;
  readonly status: ProfileStatus;
  readonly headshotUrl: string | null;
  readonly updatedAt: string;
}

export interface CreateConsultantInput {
  readonly name: string;
  readonly email: string;
  readonly role?: string;
}

/** Editable fields surfaced by the completion wizard. */
export interface ProfilePatch {
  readonly name?: string;
  readonly role?: string | null;
  readonly headline?: string | null;
  readonly bio?: string | null;
  readonly headshotUrl?: string | null;
  readonly skills?: readonly Skill[];
  readonly stories?: readonly Story[];
  readonly testimonial?: Testimonial | null;
}

export const STATUS_LABELS: Record<ProfileStatus, string> = {
  draft: 'Draft',
  invited: 'Invited',
  in_progress: 'In progress',
  submitted: 'Submitted',
  published: 'Published',
  archived: 'Archived',
};

export const STATUS_ORDER: readonly ProfileStatus[] = [
  'draft',
  'invited',
  'in_progress',
  'submitted',
  'published',
  'archived',
];

/** Result shape for form server actions (used with React `useActionState`). */
export interface FormState {
  readonly error: string | null;
}
