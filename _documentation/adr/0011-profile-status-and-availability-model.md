# 0011 — Profile status model + availability axis (V1)

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Jason (founder), CTO (Claude)
- **Supersedes / amends:** PRD §5 (lifecycle), §7 (status acceptance), §9 (wizard), §10 (data model). Pulls forward parts of PRD §17 (V2 talent hub).

## Context

The V1 PRD modelled a single linear profile lifecycle: `Draft → Invited → In progress → Submitted → Published → Archived`. One status carried two unrelated meanings at once: *how complete is the profile* and *can it be shared*.

During the UI build we hit two problems with that single axis:

1. **Completion and shareability are not the same question as market position.** The owner needs to know "is this person available to pitch right now, and if not, when?" — independently of whether their profile is written. A polished, published profile for someone who is fully engaged for six months is a different thing from the same profile for someone free next week. One linear status cannot say both.
2. **`Invited` and `Submitted` were ceremony, not state.** Whether an invite link exists is a property of the link (`MagicLink`), not the profile. "Submitted" as a locked, owner-only review gate added a step without earning its keep at pilot scale — the owner edits freely regardless.

The PRD already anticipated this: §17 (V2 "managed talent hub") describes an availability/freshness loop and a two-axis pipeline. The build pulled that forward because the pilot tenant (Change Connected) needs it on day one to run their bench.

These were deliberate product calls made during implementation, recorded here after the fact so the docs match `apps/web/lib/types.ts` (the source of truth).

## Decision

In the context of **modelling a consultant profile for the owner's dashboard**, facing the fact that **one linear status conflated profile-completeness with market availability**, we decided for **two independent axes — a simplified `status` lifecycle and a separate `availability` model — and brought the availability axis forward from V2**, and neglected **the six-state linear lifecycle (`Draft…Archived`) and deferring availability to V2**, to achieve **a dashboard that answers both "is this profile ready?" and "can I pitch this person, and when?" at a glance**, accepting **that V1 now carries more model than the original PRD scoped, and that "availability" language sits close to the §3 non-goal of a staffing marketplace (clarified below).**

### Axis 1 — `status` (profile lifecycle, owner-controlled)

| Value | Meaning |
|-------|---------|
| `no_profile` | Record exists (name + email) but nothing filled in. |
| `in_progress` | Consultant is working on their profile (wizard open / partially complete). |
| `active` | Live and visible; eligible for client share links. |
| `removed` | Deactivated / archived; hidden from the Collective, links dead, data retained. |

Order for display/filtering: `no_profile → in_progress → active → removed`. The old `Invited` state is gone (invite existence is a `MagicLink` property, not a profile state); `Submitted` and `Published` collapse into `active` (the owner publishes by setting `active`).

### Axis 2 — `availability` (market position, owner/associate-controlled)

```ts
interface Availability {
  status: 'available' | 'looking' | 'engaged' | 'pitched';
  noticePeriod?: 'immediate' | '1_week' | '2_weeks' | '1_month' | '3_months' | '6_months';
  endDate?: string; // ISO; when an engaged consultant rolls off
}
```

| Value | Meaning |
|-------|---------|
| `available` | Free to be pitched now. |
| `looking` | Open but currently committed; `noticePeriod` says how soon they can move. |
| `engaged` | On an assignment; `endDate` says when they roll off. |
| `pitched` | Put forward on an opportunity; awaiting outcome. |

The two axes are orthogonal: a profile can be `active` + `engaged`, or `in_progress` + `available`. The dashboard renders them as separate badges (`StatusBadge`, `AvailabilityBadge`).

### Headshot upload

The completion wizard's Identity step takes a **photo upload** (brand treatment — grayscale / accent ring — applied at render). The profile carries `headshotUrl`. Implementation of the storage/crop pipeline is tracked as backlog S5/CP-photo; the model and wizard step are V1.

## Consequences

**Good**
- The dashboard answers the owner's real question: who can I put in front of a client, and when.
- `status` is now honestly about lifecycle only; link state lives on the link.
- V2's talent-hub direction (§17) is de-risked — the data shape is in place from V1.

**Costs / risks**
- More surface than the original V1 scope (two enums, notice-period + end-date logic, two badges, dashboard filtering).
- **Non-goal boundary.** §3 still rules out a *staffing marketplace*: no public availability feed, no booking, no day-rate/billing logic, no client-facing availability. This `availability` axis is **internal talent-pool management for the owner only** — it is not exposed on client share views. PRD §3 is amended to draw that line explicitly rather than blanket-excluding "availability".
- Any client share view or PDF must NOT leak `availability` (owner-internal). Enforced at the renderer boundary.

## Compliance

- Source of truth: `apps/web/lib/types.ts` (`ProfileStatus`, `AvailabilityStatus`, `NoticePeriod`, `Availability`, `STATUS_ORDER`, `STATUS_LABELS`, `AVAILABILITY_LABELS`, `NOTICE_PERIOD_LABELS`).
- Renderer/share boundary must omit `availability` from client-facing output (review at code review; candidate for a golden test).
