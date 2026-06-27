/**
 * Fixture repository — DEV SEAM ONLY.
 *
 * Seeded, in-memory implementation of ProfileRepository so the UI runs with
 * `pnpm dev` before `@bench/data` (DynamoDB) is deployed. NOT a production data
 * layer and NOT an architecture decision — it exists purely so the screens are
 * clickable now. Replace via `getRepository()` once `@bench/data` lands.
 *
 * State is cached on globalThis so it survives dev hot-reloads within a process.
 */
import type {
  Availability,
  CreateConsultantInput,
  Profile,
  ProfilePatch,
  ProfileStatus,
  ProfileSummary,
} from '@/lib/types';
import type { ProfileRepository } from '@/lib/data/repository';
import { PILOT_TENANT_ID } from '@/lib/tenant';

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

function seed(): Profile[] {
  const ts = '2026-06-20T09:00:00.000Z';
  return [
    {
      id: 'oliver-bradley',
      tenantId: PILOT_TENANT_ID,
      name: 'Oliver Bradley',
      email: 'oliver@changeconnected.co.uk',
      role: 'Founder & Chief Connecting Officer',
      status: 'active',
      availability: { status: 'engaged', endDate: '2026-09-30' },
      headline: 'Connecting great talent, delivering great change',
      bio: 'Over a decade connecting organisations with outcome-focused Change Makers across Higher Education, Legal, FMCG, Retail, Automotive and Professional Services. Believes successful change comes down to the right people at the right time, without the jargon or the upselling.',
      headshotUrl: null,
      skills: [
        { id: uid(), title: 'Talent Curation', body: 'Builds trusted communities of proven change professionals matched on mindset, not just CVs.', order: 0 },
        { id: uid(), title: 'Engagement Design', body: 'Shapes flexible interim and independent models that scale up or down to the stage of change.', order: 1 },
        { id: uid(), title: 'Transformation Advisory', body: 'Runs short discovery sessions (TAP) that bring clarity before a client commits.', order: 2 },
      ],
      stories: [
        { id: uid(), clientTag: 'Greene King', title: 'Network delivery on demand', body: 'Assembled a delivery team through a trusted network for a specific transformation, delivered first-time and recommended without hesitation.', order: 0 },
        { id: uid(), clientTag: 'Cross-sector', title: 'Ten years, one truth', body: 'Across HE, Legal, FMCG, Retail and Automotive: successful change always came down to having the right people.', order: 1 },
      ],
      testimonial: {
        quote: "When I've needed to bring in a team to deliver a specific piece of work, Oli has been the first person I've gone to, and he's always delivered through his network of high-quality people.",
        authorName: 'Interim Director',
        authorRole: 'Interim Director',
        authorCompany: 'Greene King',
      },
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'priya-nair',
      tenantId: PILOT_TENANT_ID,
      name: 'Priya Nair',
      email: 'priya.nair@example.com',
      role: 'Change & Transformation Lead',
      status: 'active',
      availability: { status: 'looking', noticePeriod: '1_month' },
      headline: 'Driving value from strategy to execution',
      bio: 'Transformation lead specialising in regulated environments. Turns ambiguous mandates into delivered outcomes, with a bias for measurable impact and teams that keep moving after she leaves.',
      headshotUrl: null,
      skills: [
        { id: uid(), title: 'Operating Model Design', body: 'Redesigns target operating models that survive contact with delivery.', order: 0 },
        { id: uid(), title: 'Agile at Scale', body: 'Stands up SAFe/Kanban delivery without the ceremony overhead.', order: 1 },
        { id: uid(), title: 'Regulatory Change', body: 'Hands-on exposure to DORA and NIS2 programme delivery.', order: 2 },
      ],
      stories: [
        { id: uid(), clientTag: 'Aviation', title: '15k cabin crew, ten hours to two seconds', body: 'Replaced a manual rostering check across 15,000 cabin crew, cutting a ten-hour process to under two seconds.', order: 0 },
        { id: uid(), clientTag: 'Financial Services', title: 'DORA readiness in one quarter', body: 'Took a tier-1 bank from gap analysis to audit-ready operational resilience in a single quarter.', order: 1 },
      ],
      testimonial: null,
      createdAt: ts,
      updatedAt: '2026-06-22T14:30:00.000Z',
    },
    {
      id: 'marcus-hale',
      tenantId: PILOT_TENANT_ID,
      name: 'Marcus Hale',
      email: 'marcus.hale@example.com',
      role: 'Delivery Director',
      status: 'in_progress',
      availability: { status: 'available' },
      headline: null,
      bio: null,
      headshotUrl: null,
      skills: [],
      stories: [],
      testimonial: null,
      createdAt: ts,
      updatedAt: '2026-06-24T11:05:00.000Z',
    },
    {
      id: 'sara-okoro',
      tenantId: PILOT_TENANT_ID,
      name: 'Sara Okoro',
      email: 'sara.okoro@example.com',
      role: null,
      status: 'no_profile',
      availability: { status: 'pitched' },
      headline: null,
      bio: null,
      headshotUrl: null,
      skills: [],
      stories: [],
      testimonial: null,
      createdAt: '2026-06-25T08:15:00.000Z',
      updatedAt: '2026-06-25T08:15:00.000Z',
    },
  ];
}

interface Store {
  profiles: Profile[];
}

const g = globalThis as unknown as { __benchFixture?: Store };
function store(): Store {
  if (!g.__benchFixture) {
    g.__benchFixture = { profiles: seed() };
  }
  return g.__benchFixture;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const toSummary = (p: Profile): ProfileSummary => ({
  id: p.id,
  name: p.name,
  role: p.role,
  status: p.status,
  availability: p.availability,
  headshotUrl: p.headshotUrl,
  updatedAt: p.updatedAt,
});

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || uid();

export function createFixtureRepository(): ProfileRepository {
  return {
    async list(tenantId) {
      return store()
        .profiles.filter((p) => p.tenantId === tenantId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(toSummary);
    },

    async get(tenantId, profileId) {
      const found = store().profiles.find(
        (p) => p.tenantId === tenantId && p.id === profileId,
      );
      return found ? clone(found) : null;
    },

    async create(tenantId, input) {
      const s = store();
      let id = slugify(input.name);
      if (s.profiles.some((p) => p.id === id)) id = `${id}-${uid()}`;
      const profile: Profile = {
        id,
        tenantId,
        name: input.name.trim(),
        email: input.email.trim(),
        role: input.role?.trim() || null,
        status: 'no_profile',
        availability: { status: 'available' },
        headline: null,
        bio: null,
        headshotUrl: null,
        skills: [],
        stories: [],
        testimonial: null,
        createdAt: now(),
        updatedAt: now(),
      };
      s.profiles.push(profile);
      return clone(profile);
    },

    async update(tenantId, profileId, patch) {
      const s = store();
      const idx = s.profiles.findIndex(
        (p) => p.tenantId === tenantId && p.id === profileId,
      );
      const existing = s.profiles[idx];
      if (!existing) throw new Error('Profile not found');
      const next: Profile = {
        ...existing,
        ...('name' in patch && patch.name !== undefined ? { name: patch.name } : {}),
        ...('role' in patch ? { role: patch.role ?? null } : {}),
        ...('headline' in patch ? { headline: patch.headline ?? null } : {}),
        ...('bio' in patch ? { bio: patch.bio ?? null } : {}),
        ...('headshotUrl' in patch ? { headshotUrl: patch.headshotUrl ?? null } : {}),
        ...(patch.skills ? { skills: patch.skills } : {}),
        ...(patch.stories ? { stories: patch.stories } : {}),
        ...('testimonial' in patch ? { testimonial: patch.testimonial ?? null } : {}),
        ...(patch.availability ? { availability: patch.availability } : {}),
        updatedAt: now(),
      };
      s.profiles[idx] = next;
      return clone(next);
    },

    async setStatus(tenantId, profileId, status: ProfileStatus) {
      const s = store();
      const idx = s.profiles.findIndex(
        (p) => p.tenantId === tenantId && p.id === profileId,
      );
      const existing = s.profiles[idx];
      if (!existing) throw new Error('Profile not found');
      const updated = { ...existing, status, updatedAt: now() };
      s.profiles[idx] = updated;
      return clone(updated);
    },
  };
}
