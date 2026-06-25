# CCHub Project Context

> Thin pointer to global protocols and project-specific context.

## Global Protocols

See `C:\VSProjects\CLAUDE.md` for:
- Session protocols (TDD non-negotiable)
- Absolute rules (no quick fixes, present options)
- Agent boundary rules

## Project Architecture

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 15 App Router (`apps/web`)
- **Domain**: Pure TypeScript (`packages/@cchub/domain`)
- **Infrastructure**: AWS CDK (`infrastructure/`)
- **Region**: eu-west-2 (London) - UK data residency

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| DynamoDB single-table | Fast link lookups via GSI, serverless-native |
| Amplify Hosting | Faster to stand up for v1 |
| Magic links, not accounts | Zero friction for consultants and clients |
| KMS-signed JWTs | Secure session tokens without Cognito for link users |

## Domain

- `cchub.opstack.uk` - main domain
- `assets.cchub.opstack.uk` - CloudFront for headshots/PDFs

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

See `_documentation/graphics-references/brand-style-guide.md`
