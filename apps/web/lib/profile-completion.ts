/**
 * Profile completion model for the Collective Dashboard.
 *
 * Derives a six-section completeness score from a full `Profile`. This stays a
 * pure function (no React, no data layer) so it can be reused by the dashboard
 * and unit-tested in isolation. The `ProfileSummary` row deliberately lacks the
 * fields needed here, so the dashboard loads full profiles to compute this.
 */
import type { Profile } from '@/lib/types';

export interface CompletionSections {
  readonly identity: boolean;
  readonly positioning: boolean;
  readonly skills: boolean;
  readonly stories: boolean;
  readonly testimonial: boolean;
  readonly photo: boolean;
}

export interface Completion {
  readonly completed: number;
  readonly total: number;
  readonly percent: number;
  readonly sections: CompletionSections;
}

/**
 * Compute the completion state for a full profile.
 *
 * Section rules:
 * - identity:    name && role
 * - positioning: headline && bio
 * - skills:      at least 3 skills
 * - stories:     at least 3 stories
 * - testimonial: a testimonial is present
 * - photo:       a headshot URL is present
 */
export function computeCompletion(profile: Profile): Completion {
  const sections: CompletionSections = {
    identity: Boolean(profile.name && profile.role),
    positioning: Boolean(profile.headline && profile.bio),
    skills: profile.skills.length >= 3,
    stories: profile.stories.length >= 3,
    testimonial: profile.testimonial != null,
    photo: profile.headshotUrl != null,
  };

  const total = 6;
  const completed = Object.values(sections).filter(Boolean).length;
  const percent = Math.round((completed / total) * 100);

  return { completed, total, percent, sections };
}
