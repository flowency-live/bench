/**
 * Profile model — two independent axes (ADR-0011):
 *   1. `status`       — admin-controlled lifecycle (is the profile ready?)
 *   2. `availability` — market position (can we pitch this person, and when?)
 */

/** Profile lifecycle status (axis 1). */
export type ProfileStatus =
  | 'no_profile' // record exists (name + email), nothing filled in
  | 'in_progress' // consultant is completing the wizard
  | 'active' // published, live, eligible for client share links
  | 'removed'; // deactivated / archived; hidden, links dead, data retained

/** Notice period for the `looking` availability state. */
export type NoticePeriod =
  | 'immediate'
  | '1_week'
  | '2_weeks'
  | '1_month'
  | '3_months'
  | '6_months';

/** Availability status (axis 2) — owner-internal; never shown on client views. */
export type AvailabilityStatus = 'available' | 'looking' | 'engaged' | 'pitched';

/** Availability details; the optional fields depend on `status`. */
export interface Availability {
  readonly status: AvailabilityStatus;
  /** For `looking`: how soon they can start. */
  readonly noticePeriod?: NoticePeriod;
  /** For `engaged`: ISO date they roll off / become available. */
  readonly endDate?: string;
}

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

/**
 * Rates and working preferences.
 */
export interface ProfileRatesAndPreferences {
  /** @deprecated Use outsideIR35RatePence/insideIR35RatePence instead. Kept for backwards compat. */
  readonly minDayRatePence?: number | null;
  /** Day rate for Outside IR35 contract work in pence (e.g., 75000 = £750.00). */
  readonly outsideIR35RatePence: number | null;
  /** Day rate for Inside IR35 contract work in pence (e.g., 65000 = £650.00). */
  readonly insideIR35RatePence: number | null;
  /** Target annual salary in pence (e.g., 9500000 = £95,000.00). */
  readonly salaryPence: number | null;
  /** Employment type preferences (can select both). */
  readonly employmentTypes: readonly EmploymentType[];
  /** IR35 preferences when contract is selected. */
  readonly ir35Statuses: readonly IR35Status[];
  /** Whether consultant operates via Limited Company (Outside IR35 only). */
  readonly hasLtdCo: boolean;
  /** Location (UK city from Google Places). */
  readonly location: ProfileLocation | null;
}

/**
 * Complete profile entity (ADR-0011 two-axis model).
 */
export interface Profile {
  readonly id: string;
  readonly tenantId: string;
  readonly consultantName: string;
  readonly consultantEmail: string;
  readonly role: string | null;
  readonly status: ProfileStatus;
  readonly availability: Availability;
  readonly ratesAndPreferences: ProfileRatesAndPreferences | null;
  readonly positioning: ProfilePositioning | null;
  readonly headshotAssetId: string | null;
  readonly skills: readonly ProfileSkill[];
  readonly stories: readonly ProfileStory[];
  readonly testimonial: ProfileTestimonial | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Minimal profile for roster display.
 */
export interface ProfileSummary {
  readonly id: string;
  readonly tenantId: string;
  readonly consultantName: string;
  readonly role: string | null;
  readonly status: ProfileStatus;
  readonly availability: Availability;
  readonly headshotUrl: string | null;
  readonly updatedAt: string;
}
