# Bench Project Context

> Thin pointer to global protocols and project-specific context.

## Global Protocols

See `C:\VSProjects\CLAUDE.md` for:
- Session protocols (TDD non-negotiable)
- Absolute rules (no quick fixes, present options)
- Agent boundary rules

## Project Architecture

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 15 App Router (`apps/web`)
- **Domain**: Pure TypeScript (`packages/@bench/domain`)
- **Infrastructure**: AWS CDK (`infrastructure/`)
- **Region**: eu-west-2 (London) - UK data residency

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Aurora Serverless v2 + pgvector | SQL flexibility, RLS for tenant isolation, vector search for skills |
| Pooled multi-tenancy with RLS | Single DB, row-level security per tenant, cost-efficient |
| Amplify Hosting | Faster to stand up for v1 |
| Magic links, not accounts | Zero friction for consultants and clients |
| KMS-signed JWTs | Secure session tokens without Cognito for link users |
| `@bench/*` namespace | White-label product branding (ADR-0003) |
| Live-site brand tokens | Poppins, navy #001930, lime #BAEB5B (ADR-0004) |

## Domain

- `bench.opstack.uk` - main domain
- `assets.bench.opstack.uk` - CloudFront for headshots/PDFs

## Quick Commands

```bash
pnpm install          # Install all dependencies
pnpm dev              # Start dev servers
pnpm test             # Run all tests
pnpm test:unit        # Run unit tests only
pnpm deploy:all       # Deploy all CDK stacks
```

## PRD

See `_documentation/prd-consultant-profile-platform.md`

## Brand

See `_documentation/graphics-references/brand-tokens.md` (canonical tokens from live site)
