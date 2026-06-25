# Bench — Documentation

This directory is the **single source of truth** for product and architecture decisions on Bench.
It is **maintained by the CTO / architecture owner**, not by feature agents. Implementation agents
(VSCode or otherwise) should *read* these documents and treat them as binding. Changes happen through
the ADR process below — never by ad-hoc edits or "restoring" files.

## Contents

| Path | What it is |
|------|------------|
| `prd-consultant-profile-platform.md` | **Canonical PRD (v0.5).** Multi-tenant, white-label platform. Change Connected is pilot tenant #1 ("Change Hub"). |
| `adr/` | **Architecture Decision Records** — the "why" behind binding technical choices. Start at `adr/README.md`. |
| `BACKLOG.md` | **Work tracker** — status, owners, and what's next. The live source of truth for *work* (ADRs are for decisions, the PRD for requirements). |
| `realignment-workplan.md` | **Work order for implementation agents** — the ordered tasks to realign Phase 0 to v0.5. Point the VSCode agent here. |
| `graphics-references/brand-tokens.md` | **Canonical design tokens**, verified against the live site `changeconnected.co.uk`. |
| `graphics-references/brand-style-guide.md` | Descriptive brand guide (reconciled to the live site). |
| `graphics-references/logo-*.webp` | Logo asset. |
| `archive/` | Superseded documents kept for history (e.g. PRD v0.2). |

## Status snapshot (2026-06-25)

- **PRD:** v0.5 is canonical. v0.2 (single-tenant, DynamoDB) is archived and **superseded**.
- **Data store:** realigning from DynamoDB (Phase 0) to **Aurora Serverless v2 Postgres + pgvector** — see [ADR-0001](adr/0001-data-store.md).
- **Tenancy:** pooled + Postgres **RLS**, multi-tenant from the first migration — see [ADR-0002](adr/0002-multi-tenancy-pooled-rls.md).
- **Namespace:** standardized to `@bench/*` — see [ADR-0003](adr/0003-package-namespace-bench.md) (implemented).
- **Brand:** live site is the source of truth — see [ADR-0004](adr/0004-brand-source-of-truth.md). Code tokens still being corrected.

## How to propose or change a decision

1. Copy `adr/0000-template.md` to the next number, e.g. `adr/0008-my-decision.md`.
2. Write it up as **Proposed**, link the PRD section and any code it affects.
3. Get CTO sign-off; flip status to **Accepted** with a date.
4. If it replaces an earlier ADR, set that one to **Superseded by 000X** and link both ways.
5. Update the index in `adr/README.md`.

Agents must not modify files in this directory. If a decision needs to change, raise it with the CTO
and it goes through the ADR process.
