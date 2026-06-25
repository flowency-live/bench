/**
 * ProfileRepository — the data-access contract for the Bench portal.
 *
 * This is the seam. The UI only ever talks to this interface. `@bench/data`
 * (DynamoDB, per ADR-0008) will provide the production implementation; swapping
 * it in is a one-line change in `getRepository()` below. Every method is
 * tenant-scoped (tenantId first) to match the `TENANT#` app-enforced isolation
 * model — the UI never reaches the table directly.
 */
import type {
  CreateConsultantInput,
  Profile,
  ProfilePatch,
  ProfileStatus,
  ProfileSummary,
} from '@/lib/types';
import { createFixtureRepository } from '@/lib/data/fixture-repository';
import { createDynamoProfileRepository } from '@/lib/data/dynamo-repository';

export interface ProfileRepository {
  list(tenantId: string): Promise<ProfileSummary[]>;
  get(tenantId: string, profileId: string): Promise<Profile | null>;
  create(tenantId: string, input: CreateConsultantInput): Promise<Profile>;
  update(tenantId: string, profileId: string, patch: ProfilePatch): Promise<Profile>;
  setStatus(tenantId: string, profileId: string, status: ProfileStatus): Promise<Profile>;
}

let instance: ProfileRepository | null = null;

/**
 * Resolve the active repository.
 *
 * - DATA_BACKEND=dynamodb → the real DynamoDB layer (ADR-0008). Requires
 *   BENCH_TABLE_NAME (and AWS creds in the runtime's environment/role).
 * - otherwise → the seeded fixture, so the UI runs locally with no AWS.
 *
 * This is the only place the backend is chosen; pages/actions never know which.
 */
export function getRepository(): ProfileRepository {
  if (instance) return instance;

  if (process.env.DATA_BACKEND === 'dynamodb') {
    const tableName = process.env.BENCH_TABLE_NAME;
    if (!tableName) {
      throw new Error('BENCH_TABLE_NAME is required when DATA_BACKEND=dynamodb');
    }
    instance = createDynamoProfileRepository({
      tableName,
      region: process.env.AWS_REGION,
    });
  } else {
    instance = createFixtureRepository();
  }

  return instance;
}
