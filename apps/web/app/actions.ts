'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getRepository } from '@/lib/data/repository';
import { PILOT_TENANT_ID } from '@/lib/tenant';
import type { FormState, ProfilePatch, ProfileStatus } from '@/lib/types';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Add a consultant (creates a Draft) then opens their profile. */
export async function createConsultant(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim();

  if (name.length < 2) return { error: 'Please enter the consultant’s full name.' };
  if (!EMAIL_RE.test(email)) return { error: 'Please enter a valid email address.' };

  const repo = getRepository();
  const profile = await repo.create(PILOT_TENANT_ID, {
    name,
    email,
    role: role || undefined,
  });

  revalidatePath('/dashboard');
  redirect(`/profiles/${profile.id}`);
}

/** Change a profile's lifecycle status (publish / archive / etc.). */
export async function changeStatus(formData: FormData): Promise<void> {
  const profileId = String(formData.get('profileId') ?? '');
  const status = String(formData.get('status') ?? '') as ProfileStatus;
  if (!profileId || !status) return;

  const repo = getRepository();
  await repo.setStatus(PILOT_TENANT_ID, profileId, status);

  revalidatePath('/dashboard');
  revalidatePath(`/profiles/${profileId}`);
}

/** Save wizard edits to a profile. Called from the client wizard. */
export async function saveProfile(profileId: string, patch: ProfilePatch) {
  const repo = getRepository();
  const updated = await repo.update(PILOT_TENANT_ID, profileId, patch);
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath('/dashboard');
  return updated;
}

/** Consultant submits their completed profile for owner review. */
export async function submitForReview(profileId: string) {
  const repo = getRepository();
  await repo.setStatus(PILOT_TENANT_ID, profileId, 'submitted');
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath('/dashboard');
}
