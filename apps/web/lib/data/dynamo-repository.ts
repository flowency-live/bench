/**
 * DynamoDB-backed repository for the UI.
 *
 * Thin adapter over `@bench/data` (ADR-0008): it wraps the canonical
 * `@bench/types` `ProfileRepository` and maps the domain model to the UI view
 * model at the boundary (see `map-domain.ts`). Selected by `getRepository()`
 * when `DATA_BACKEND=dynamodb`.
 */
import { createClient, createProfileRepository } from '@bench/data';
import type { ProfileRepository } from '@/lib/data/repository';
import {
  toCreateInput,
  toPatch,
  toViewProfile,
  toViewSummary,
} from '@/lib/data/map-domain';

export interface DynamoConfig {
  readonly tableName: string;
  readonly region?: string;
}

export function createDynamoProfileRepository(config: DynamoConfig): ProfileRepository {
  const repo = createProfileRepository(
    createClient(config.region ? { region: config.region } : undefined),
    config.tableName,
  );

  return {
    async list(tenantId) {
      const rows = await repo.list(tenantId);
      return rows.map(toViewSummary);
    },
    async get(tenantId, profileId) {
      const profile = await repo.get(tenantId, profileId);
      return profile ? toViewProfile(profile) : null;
    },
    async create(tenantId, input) {
      return toViewProfile(await repo.create(tenantId, toCreateInput(input)));
    },
    async update(tenantId, profileId, patch) {
      return toViewProfile(await repo.update(tenantId, profileId, toPatch(patch)));
    },
    async setStatus(tenantId, profileId, status) {
      return toViewProfile(await repo.setStatus(tenantId, profileId, status));
    },
  };
}
