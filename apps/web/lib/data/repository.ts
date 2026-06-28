/**
 * ProfileRepository — the data-access contract for the Bench portal.
 *
 * DynamoDB single-table design (ADR-0008). Every method is tenant-scoped
 * (tenantId first) to match the `TENANT#` app-enforced isolation model.
 */
import type {
  CreateConsultantInput,
  Profile,
  ProfilePatch,
  ProfileStatus,
  ProfileSummary,
} from '@/lib/types';
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
 * Get the DynamoDB profile repository.
 * Requires BENCH_TABLE_NAME environment variable.
 */
export function getRepository(): ProfileRepository {
  if (instance) return instance;

  const tableName = process.env.BENCH_TABLE_NAME ?? 'bench-main';
  instance = createDynamoProfileRepository({
    tableName,
    region: process.env.AWS_REGION ?? 'eu-west-2',
  });

  return instance;
}
