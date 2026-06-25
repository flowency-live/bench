# Data Contract — `ProfileRepository`

One canonical contract for profile data access, so the UI and `@bench/data` stop drifting apart.

**Canonical shape = the existing `@bench/types` domain model** (`Profile`, `ProfileSummary`,
`ProfileSkill`, `ProfileStory`, `ProfileTestimonial`, `ProfilePositioning`, `ProfileStatus`). The
repository interface is published alongside them in `@bench/types`. `@bench/data` implements it; the
web app consumes it and maps to its own lightweight **view model** at the render boundary (the UI's
`name`/`headline`/`headshotUrl` are view conveniences — `consultantName`/`positioning`/`headshotAssetId`
are canonical; `headshotUrl` is resolved from the asset id by the view layer).

## Interface (published in `@bench/types`)

```ts
import type { Profile, ProfileSummary, ProfileStatus, ProfilePositioning,
              ProfileSkill, ProfileStory, ProfileTestimonial } from './profile.types';

export interface CreateConsultantInput {
  consultantName: string; consultantEmail: string; role?: string;
}
export interface ProfilePatch {
  consultantName?: string; role?: string | null;
  positioning?: ProfilePositioning | null;     // { headline, bio }
  headshotAssetId?: string | null;
  skills?: readonly ProfileSkill[];
  stories?: readonly ProfileStory[];
  testimonial?: ProfileTestimonial | null;
}
export interface ProfileRepository {
  list(tenantId: string): Promise<readonly ProfileSummary[]>;
  get(tenantId: string, profileId: string): Promise<Profile | null>;   // assembles children
  create(tenantId: string, input: CreateConsultantInput): Promise<Profile>;
  update(tenantId: string, profileId: string, patch: ProfilePatch): Promise<Profile>;  // replaces child collections
  setStatus(tenantId: string, profileId: string, status: ProfileStatus): Promise<Profile>;
}
```

Every method is tenant-scoped (tenantId first); the repository is the only path to the table (ADR-0008).
`get`/`update` treat `skills`/`stories`/`testimonial` as first-class.

## Reconciliation tasks (AGENT — `@bench/data` + seed)

1. Import `Profile`/`ProfileRepository` etc. from `@bench/types`; delete `@bench/data`'s private copies
   of those types.
2. Implement the interface exactly: `findAll→list`, `findById→get`, `updateStatus→setStatus`; replace
   `updatePositioning`/`updateHeadshot` with `update(patch)`; return `Profile` (not `void`).
3. **Children:** `get` queries the profile partition and assembles `SKILL#`/`STORY#`/`TESTIMONIAL`
   into the `Profile.positioning`/`skills`/`stories`/`testimonial`; `update` replaces those child items
   (TransactWrite or batched delete-then-put).
4. **Listing:** one mechanism, no duplicates — don't carry GSI2 keys on a duplicated base-table list
   item. `list`/`findByStatus` return one row per profile.
5. **Re-seed** to the final item shape. Keep isolation tests green; add `get`-assembles-children and
   no-duplicate-listing tests.

## CTO (`@bench/types` + `apps/web`) — done / in progress

- Publish `ProfileRepository` + `CreateConsultantInput` + `ProfilePatch` in `@bench/types`. ✅
- Web build unbroken (broken skeleton removed). ✅
- After AGENT aligns `@bench/data`: `getRepository()` wraps `createProfileRepository(...)` and maps
  domain→view; UI view model kept. (One-line wire — the handoff in `COLLABORATION.md`.)

## Acceptance

- `apps/web` builds + typechecks; with `DATA_BACKEND=dynamodb`, full profiles **including
  skills/stories/testimonial** render.
- `list`/`findByStatus` return one row per profile; isolation tests green.
