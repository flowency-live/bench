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
      try {
        console.log('[dynamo-repo.update] Converting patch...');
        const domainPatch = toPatch(patch);
        console.log('[dynamo-repo.update] Domain patch keys:', Object.keys(domainPatch));

        console.log('[dynamo-repo.update] Calling @bench/data repo.update...');
        const domainProfile = await repo.update(tenantId, profileId, domainPatch);
        console.log('[dynamo-repo.update] @bench/data update succeeded');
        console.log('[dynamo-repo.update] Domain profile headshotAssetId:', domainProfile.headshotAssetId);

        console.log('[dynamo-repo.update] Converting to view profile...');
        const viewProfile = toViewProfile(domainProfile);
        console.log('[dynamo-repo.update] Conversion succeeded, headshotUrl:', viewProfile.headshotUrl);

        return viewProfile;
      } catch (error) {
        console.error('[dynamo-repo.update] ERROR:', error);
        throw error;
      }
    },
    async setStatus(tenantId, profileId, status) {
      return toViewProfile(await repo.setStatus(tenantId, profileId, status));
    },
  };
}
