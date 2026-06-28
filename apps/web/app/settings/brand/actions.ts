'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';
import { validateBrandContrast } from '@/lib/brand/contrast';
import type { BrandTokens } from '@bench/types';

export interface BrandSettingsState {
  readonly ok: boolean;
  readonly error?: string;
  readonly errors?: readonly string[];
  readonly warnings?: readonly string[];
}

/**
 * Update tenant brand settings.
 * Validates WCAG AA contrast before saving.
 */
export async function updateBrandSettings(
  _prev: BrandSettingsState,
  formData: FormData,
): Promise<BrandSettingsState> {
  const session = await getSession();
  if (!session || session.kind !== 'admin') {
    return { ok: false, error: 'Not authorized' };
  }

  const tenantId = getTenantId(session);
  if (!tenantId) {
    return { ok: false, error: 'Not authenticated' };
  }

  // Parse form data
  const instanceName = String(formData.get('instanceName') ?? '').trim();
  const bgPrimary = String(formData.get('bgPrimary') ?? '').trim();
  const bgPanel = String(formData.get('bgPanel') ?? '').trim();
  const accent = String(formData.get('accent') ?? '').trim();
  const textPrimary = String(formData.get('textPrimary') ?? '').trim();
  const textSecondary = String(formData.get('textSecondary') ?? '').trim();

  // Validate required fields
  if (!instanceName) {
    return { ok: false, error: 'Instance name is required' };
  }

  // Validate hex colors
  const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  const colors = { bgPrimary, bgPanel, accent, textPrimary, textSecondary };
  for (const [key, value] of Object.entries(colors)) {
    if (!hexPattern.test(value)) {
      return { ok: false, error: `Invalid color format for ${key}. Use hex format (#000000)` };
    }
  }

  // Validate WCAG AA contrast
  const validation = validateBrandContrast(colors);
  if (!validation.valid) {
    return {
      ok: false,
      error: 'Colors fail WCAG 2.1 AA accessibility requirements',
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  // Get current tenant to preserve fields not being updated
  const repo = getTenantRepository();
  const tenant = await repo.get(tenantId);
  if (!tenant) {
    return { ok: false, error: 'Tenant not found' };
  }

  // Build the brand tokens update (merge with existing)
  const brandTokens: Partial<BrandTokens> = {
    bgPrimary,
    bgPanel,
    accent,
    textPrimary,
    textSecondary,
  };

  try {
    // Update using the extended repository
    // Note: update method is from ExtendedTenantRepository in @bench/data
    const { createTenantRepository, createClient } = await import('@bench/data');
    const tableName = process.env.BENCH_TABLE_NAME ?? 'bench-main';
    const client = createClient({ region: process.env.AWS_REGION ?? 'eu-west-2' });
    const extendedRepo = createTenantRepository(client, tableName);

    await extendedRepo.update(tenantId, {
      instanceName,
      brandTokens,
    });

    // Revalidate pages that use tenant branding
    revalidatePath('/dashboard');
    revalidatePath('/settings');
    revalidatePath('/settings/brand');

    return {
      ok: true,
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
    };
  } catch (err) {
    console.error('[brand-settings-error]', err);
    return { ok: false, error: 'Failed to save brand settings' };
  }
}
