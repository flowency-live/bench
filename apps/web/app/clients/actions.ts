'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession, getTenantId } from '@/lib/auth/session';
import {
  getClientRepository,
  getClientContactRepository,
  getPortalLinkRepository,
} from '@/lib/data/client';
import { generateMagicLinkToken } from '@bench/domain/magic-link';
import type { ClientVisibilityMode } from '@bench/types';

/**
 * Create a new client.
 */
export async function createClient(formData: FormData): Promise<void> {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) throw new Error('Not authenticated');

  // Only admins can create clients
  if (session?.kind !== 'admin' && session?.kind !== 'platform') {
    throw new Error('Not authorized');
  }

  const companyName = formData.get('companyName') as string;
  const visibilityMode = (formData.get('visibilityMode') as ClientVisibilityMode) || 'all_active';

  if (!companyName?.trim()) {
    throw new Error('Company name is required');
  }

  const createdBy =
    session.kind === 'admin' ? session.email : session.kind === 'platform' ? session.email : '';

  const client = await getClientRepository().create(tenantId, {
    companyName: companyName.trim(),
    visibilityMode,
    createdBy,
  });

  revalidatePath('/clients');
  redirect(`/clients/${client.id}`);
}

/**
 * Update a client.
 */
export async function updateClient(clientId: string, formData: FormData): Promise<void> {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) throw new Error('Not authenticated');

  if (session?.kind !== 'admin' && session?.kind !== 'platform') {
    throw new Error('Not authorized');
  }

  const companyName = formData.get('companyName') as string;
  const visibilityMode = formData.get('visibilityMode') as ClientVisibilityMode;
  const handpickedJson = formData.get('handpickedProfileIds') as string;
  const handpickedProfileIds = handpickedJson ? JSON.parse(handpickedJson) : undefined;

  await getClientRepository().update(tenantId, clientId, {
    companyName: companyName?.trim() || undefined,
    visibilityMode: visibilityMode || undefined,
    handpickedProfileIds,
  });

  revalidatePath('/clients');
  revalidatePath(`/clients/${clientId}`);
}

/**
 * Delete a client.
 */
export async function deleteClient(clientId: string): Promise<void> {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) throw new Error('Not authenticated');

  if (session?.kind !== 'admin' && session?.kind !== 'platform') {
    throw new Error('Not authorized');
  }

  await getClientRepository().remove(tenantId, clientId);

  revalidatePath('/clients');
  redirect('/clients');
}

/**
 * Add a contact to a client.
 */
export async function addContact(clientId: string, formData: FormData): Promise<void> {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) throw new Error('Not authenticated');

  if (session?.kind !== 'admin' && session?.kind !== 'platform') {
    throw new Error('Not authorized');
  }

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;

  if (!name?.trim()) {
    throw new Error('Contact name is required');
  }
  if (!email?.trim()) {
    throw new Error('Contact email is required');
  }

  await getClientContactRepository().create(tenantId, clientId, {
    name: name.trim(),
    email: email.trim(),
  });

  revalidatePath(`/clients/${clientId}`);
}

/**
 * Remove a contact from a client.
 */
export async function removeContact(clientId: string, contactId: string): Promise<void> {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) throw new Error('Not authenticated');

  if (session?.kind !== 'admin' && session?.kind !== 'platform') {
    throw new Error('Not authorized');
  }

  await getClientContactRepository().remove(tenantId, clientId, contactId);

  revalidatePath(`/clients/${clientId}`);
}

/** Portal link expiry: 7 days */
const PORTAL_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Send a portal link to a client contact.
 * Returns the raw token for display (dev only) or sends email (prod).
 */
export async function sendPortalLink(
  clientId: string,
  contactId: string,
): Promise<{ success: true; devToken?: string } | { success: false; error: string }> {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) return { success: false, error: 'Not authenticated' };

  if (session?.kind !== 'admin' && session?.kind !== 'platform') {
    return { success: false, error: 'Not authorized' };
  }

  // Get the contact
  const contact = await getClientContactRepository().get(tenantId, clientId, contactId);
  if (!contact) {
    return { success: false, error: 'Contact not found' };
  }

  // Generate token
  const { raw, hash } = generateMagicLinkToken();

  // Calculate expiry
  const expiresAt = new Date(Date.now() + PORTAL_LINK_TTL_MS).toISOString();

  const createdBy =
    session.kind === 'admin' ? session.email : session.kind === 'platform' ? session.email : '';

  // Create portal link
  await getPortalLinkRepository().create(tenantId, clientId, {
    contactId,
    contactEmail: contact.email,
    tokenHash: hash,
    expiresAt,
    createdBy,
  });

  revalidatePath(`/clients/${clientId}`);

  // In development, return the token for testing
  // In production, this would send an email
  if (process.env.NODE_ENV === 'development' || process.env.SHOW_DEV_TOKENS === 'true') {
    return { success: true, devToken: raw };
  }

  // TODO: Send email with portal link
  // For now, just return success
  return { success: true };
}
