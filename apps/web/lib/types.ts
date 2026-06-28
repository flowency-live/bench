/**
 * UI view types for the Bench portal.
 *
 * These mirror `@bench/types` (domain) but are kept local so the web app runs
 * without depending on other workspace packages being built. When `@bench/data`
 * lands, map its records to these shapes (or replace these with `@bench/types`
 * imports once the package build/transpile path is settled).
 */

/** Profile status: admin-controlled lifecycle state. */
export type ProfileStatus =
  | 'no_profile'   // Exists but hasn't filled anything yet
  | 'in_progress'  // Working on their profile
  | 'active'       // Live and visible
  | 'removed';     // Deactivated/archived

/** Notice period options for "Looking" availability. */
export type NoticePeriod =
  | 'immediate'
  | '1_week'
  | '2_weeks'
  | '1_month'
  | '3_months'
  | '6_months';

/** Availability status: market position of the associate. */
export type AvailabilityStatus =
  | 'available'  // Ready to work now
  | 'looking'    // Looking, with notice period
  | 'engaged'    // Currently working, with end date
  | 'pitched';   // Linked to active work pitch

/** Availability details depending on status. */
export interface Availability {
  readonly status: AvailabilityStatus;
  /** For "looking" status: notice period before they can start. */
  readonly noticePeriod?: NoticePeriod;
  /** For "engaged" status: ISO date when they become available. */
  readonly endDate?: string;
}

/** Employment type preference. */
export type EmploymentType = 'contract' | 'permanent';

/** IR35 status for contract work. */
export type IR35Status = 'inside' | 'outside';

/** Location from Google Places autocomplete. */
export interface ProfileLocation {
  readonly placeId: string;
  readonly displayName: string;
  readonly lat: number;
  readonly lng: number;
}

/** Rates and working preferences. */
export interface RatesAndPreferences {
  /** Minimum day rate in pence (e.g., 75000 = £750.00). */
  readonly minDayRatePence: number | null;
  /** Target annual salary in pence (e.g., 9500000 = £95,000.00). */
  readonly salaryPence: number | null;
  /** Employment type preferences (can select both). */
  readonly employmentTypes: readonly EmploymentType[];
  /** IR35 preferences when contract is selected. */
  readonly ir35Statuses: readonly IR35Status[];
  /** Whether consultant operates via Limited Company. */
  readonly hasLtdCo: boolean;
  /** Location (UK city from Google Places). */
  readonly location: ProfileLocation | null;
}

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
  readonly availability: Availability;
  readonly ratesAndPreferences: RatesAndPreferences | null;
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
  readonly availability: Availability;
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
  readonly availability?: Availability;
  readonly ratesAndPreferences?: RatesAndPreferences | null;
}

export const STATUS_LABELS: Record<ProfileStatus, string> = {
  no_profile: 'No Profile',
  in_progress: 'In Progress',
  active: 'Active',
  removed: 'Removed',
};

export const STATUS_ORDER: readonly ProfileStatus[] = [
  'no_profile',
  'in_progress',
  'active',
  'removed',
];

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: 'Available',
  looking: 'Looking',
  engaged: 'Engaged',
  pitched: 'Pitched',
};

export const NOTICE_PERIOD_LABELS: Record<NoticePeriod, string> = {
  immediate: 'Immediate',
  '1_week': '1 Week',
  '2_weeks': '2 Weeks',
  '1_month': '1 Month',
  '3_months': '3 Months',
  '6_months': '6 Months',
};

export const NOTICE_PERIOD_ORDER: readonly NoticePeriod[] = [
  'immediate',
  '1_week',
  '2_weeks',
  '1_month',
  '3_months',
  '6_months',
];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  contract: 'Contract',
  permanent: 'Permanent',
};

export const IR35_STATUS_LABELS: Record<IR35Status, string> = {
  inside: 'Inside IR35',
  outside: 'Outside IR35',
};

/** Result shape for form server actions (used with React `useActionState`). */
export interface FormState {
  readonly error: string | null;
}
