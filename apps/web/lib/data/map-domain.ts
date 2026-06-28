/**
 * Boundary mapping: `@bench/types` domain model ⇄ the UI view model.
 *
 * The domain (canonical, in `@bench/types`) uses `consultantName`, nested
 * `positioning`, and `headshotAssetId`. The UI components use the flatter
 * `name`/`headline`/`bio`/`headshotUrl`. This is the one place we translate, so
 * the rest of the app keeps using view types and `@bench/data` keeps the domain.
 */
import type {
  CreateConsultantInput as DomainCreate,
  ProfilePatch as DomainPatch,
  Profile as DomainProfile,
  ProfileSummary as DomainSummary,
} from '@bench/types';
import type {
  CreateConsultantInput,
  Profile,
  ProfilePatch,
  ProfileSummary,
} from '@/lib/types';

/**
 * Resolve a headshot asset id to a render URL.
 * TODO(assets): once the S3 + CloudFront asset pipeline lands, build a CDN URL
 * here. Today the wizard stores a pasted URL as the "asset id", so passing it
 * through round-trips correctly; a missing id renders the branded monogram.
 */
function resolveHeadshotUrl(assetId: string | null): string | null {
  return assetId;
}

export function toViewProfile(d: DomainProfile): Profile {
  return {
    id: d.id,
    tenantId: d.tenantId,
    name: d.consultantName,
    email: d.consultantEmail,
    role: d.role,
    status: d.status,
    availability: d.availability,
    ratesAndPreferences: d.ratesAndPreferences
      ? {
          minDayRatePence: d.ratesAndPreferences.minDayRatePence,
          salaryPence: d.ratesAndPreferences.salaryPence,
          employmentTypes: [...d.ratesAndPreferences.employmentTypes],
          ir35Statuses: [...d.ratesAndPreferences.ir35Statuses],
          hasLtdCo: d.ratesAndPreferences.hasLtdCo,
          location: d.ratesAndPreferences.location,
        }
      : null,
    headline: d.positioning?.headline ?? null,
    bio: d.positioning?.bio ?? null,
    headshotUrl: resolveHeadshotUrl(d.headshotAssetId),
    skills: d.skills.map((s) => ({ id: s.id, title: s.title, body: s.body, order: s.order })),
    stories: d.stories.map((s) => ({
      id: s.id,
      clientTag: s.clientTag,
      title: s.title,
      body: s.body,
      order: s.order,
    })),
    testimonial: d.testimonial
      ? {
          quote: d.testimonial.quote,
          authorName: d.testimonial.authorName,
          authorRole: d.testimonial.authorRole,
          authorCompany: d.testimonial.authorCompany,
        }
      : null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export function toViewSummary(d: DomainSummary): ProfileSummary {
  return {
    id: d.id,
    name: d.consultantName,
    role: d.role,
    status: d.status,
    availability: d.availability,
    headshotUrl: d.headshotUrl ?? null,
    updatedAt: d.updatedAt,
  };
}

export function toCreateInput(i: CreateConsultantInput): DomainCreate {
  return {
    consultantName: i.name,
    consultantEmail: i.email,
    ...(i.role ? { role: i.role } : {}),
  };
}

export function toPatch(p: ProfilePatch): DomainPatch {
  return {
    ...(p.name !== undefined ? { consultantName: p.name } : {}),
    ...('role' in p ? { role: p.role ?? null } : {}),
    ...(p.availability !== undefined ? { availability: p.availability } : {}),
    ...('ratesAndPreferences' in p
      ? {
          ratesAndPreferences: p.ratesAndPreferences
            ? {
                minDayRatePence: p.ratesAndPreferences.minDayRatePence,
                salaryPence: p.ratesAndPreferences.salaryPence,
                employmentTypes: [...p.ratesAndPreferences.employmentTypes],
                ir35Statuses: [...p.ratesAndPreferences.ir35Statuses],
                hasLtdCo: p.ratesAndPreferences.hasLtdCo,
                location: p.ratesAndPreferences.location,
              }
            : null,
        }
      : {}),
    ...('headline' in p || 'bio' in p
      ? { positioning: { headline: p.headline ?? '', bio: p.bio ?? '' } }
      : {}),
    ...('headshotUrl' in p ? { headshotAssetId: p.headshotUrl ?? null } : {}),
    ...(p.skills
      ? { skills: p.skills.map((s) => ({ id: s.id, title: s.title, body: s.body, order: s.order })) }
      : {}),
    ...(p.stories
      ? {
          stories: p.stories.map((s) => ({
            id: s.id,
            clientTag: s.clientTag,
            title: s.title,
            body: s.body,
            order: s.order,
          })),
        }
      : {}),
    ...('testimonial' in p
      ? {
          testimonial: p.testimonial
            ? {
                id: 'testimonial',
                quote: p.testimonial.quote,
                authorName: p.testimonial.authorName,
                authorRole: p.testimonial.authorRole,
                authorCompany: p.testimonial.authorCompany,
              }
            : null,
        }
      : {}),
  };
}
