# Architecture Decision Records

Binding technical decisions for Bench. Each ADR captures the context, the decision, and its
consequences so future contributors (and agents) understand *why*, not just *what*.

Format: lightweight [MADR](https://adr.github.io/madr/). Statuses: **Proposed**, **Accepted**,
**Superseded**, **Deprecated**.

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| [0001](0001-data-store.md) | Data store: Aurora Serverless v2 Postgres + pgvector | ~~Superseded by 0008~~ | 2026-06-25 |
| [0002](0002-multi-tenancy-pooled-rls.md) | Multi-tenancy: pooled model + Postgres RLS | ~~Superseded by 0008~~ | 2026-06-25 |
| [0003](0003-package-namespace-bench.md) | Package namespace: `@bench/*` | Accepted | 2026-06-25 |
| [0004](0004-brand-source-of-truth.md) | Brand source of truth: the live site | Accepted | 2026-06-25 |
| [0005](0005-magic-link-sessions.md) | Link-scoped sessions: hashed tokens + KMS-signed JWT | Accepted | 2026-06-25 |
| [0006](0006-app-hosting.md) | App hosting: Amplify vs OpenNext | Proposed | 2026-06-25 |
| [0007](0007-domain-and-dns.md) | Domain & DNS strategy | Proposed | 2026-06-25 |
| [0008](0008-revert-to-dynamodb.md) | **Revert data store to DynamoDB single-table** | Accepted | 2026-06-25 |
| [0009](0009-admin-auth-magic-link.md) | Admin/owner auth: passwordless magic-link (V1) | Accepted | 2026-06-25 |
| [0010](0010-multi-tenant-control-plane.md) | **Multi-tenant control plane** — godmode + tenant/user RBAC | Accepted | 2026-06-25 |

## Conventions

- One decision per file, numbered sequentially, kebab-case title.
- Never delete an ADR. Supersede it and link forward.
- Keep them short. If it needs a diagram, link an asset rather than inlining a wall of text.
