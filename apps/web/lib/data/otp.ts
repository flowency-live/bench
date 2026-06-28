/**
 * OtpRepository accessor for the UI.
 * DynamoDB single-table design (ADR-0014 phone OTP for passwordless auth).
 */

import type { OtpRepository, OtpCreateResult } from '@bench/data';

export type { OtpCreateResult };

let instance: OtpRepository | null = null;

/**
 * Get the DynamoDB OTP repository.
 */
export function getOtpRepository(): OtpRepository {
  if (instance) return instance;

  const tableName = process.env.BENCH_TABLE_NAME ?? 'bench-main';
  const { createClient, createOtpRepository } = require('@bench/data') as typeof import('@bench/data');

  instance = createOtpRepository(
    createClient({ region: process.env.AWS_REGION ?? 'eu-west-2' }),
    tableName,
  );

  return instance;
}
