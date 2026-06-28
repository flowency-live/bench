'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getRepository } from '@/lib/data/repository';
import type { RatesAndPreferences } from '@/lib/types';

export interface RatesActionState {
  success: boolean;
  error?: string;
}

/**
 * Server action to update profile rates.
 * Admin-only: requires admin or platform session.
 */
export async function updateRates(
  profileId: string,
  rates: RatesAndPreferences | null,
): Promise<RatesActionState> {
  const session = await getSession();

  // Only admin or platform sessions can update rates
  if (!session || session.kind === 'member') {
    return { success: false, error: 'Not authorized' };
  }

  const tenantId = getTenantId(session);
  if (!tenantId) {
    return { success: false, error: 'No tenant context' };
  }

  const repo = getRepository();
  const profile = await repo.get(tenantId, profileId);
  if (!profile) {
    return { success: false, error: 'Profile not found' };
  }

  await repo.update(tenantId, profileId, { ratesAndPreferences: rates });
  revalidatePath(`/profiles/${profileId}`);

  return { success: true };
}
