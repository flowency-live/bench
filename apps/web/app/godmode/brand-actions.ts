'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { getPlatformSession } from '@/lib/auth/platform';
import { getTenantRepository } from '@/lib/data/tenant';
import { validateBrandContrast } from '@/lib/brand/contrast';
import type { BrandTokens } from '@bench/types';

export interface BrandSettingsState {
  readonly ok: boolean;
  readonly error?: string;
  readonly errors?: readonly string[];
  readonly warnings?: readonly string[];
  readonly logoAssetId?: string;
}

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

/**
 * Update a tenant's brand settings (godmode only).
 * Requires platform session. Validates WCAG AA contrast before saving.
 */
export async function updateTenantBrandSettings(
  _prev: BrandSettingsState,
  formData: FormData,
): Promise<BrandSettingsState> {
  const platform = await getPlatformSession();
  if (!platform) {
    return { ok: false, error: 'Not authorized' };
  }

  const tenantId = String(formData.get('tenantId') ?? '').trim();
  if (!tenantId) {
    return { ok: false, error: 'Tenant ID is required' };
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

  // Get current tenant to verify it exists
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
    const { createTenantRepository, createClient } = await import('@bench/data');
    const tableName = process.env.BENCH_TABLE_NAME ?? 'bench-main';
    const client = createClient({ region: process.env.AWS_REGION ?? 'eu-west-2' });
    const extendedRepo = createTenantRepository(client, tableName);

    await extendedRepo.update(tenantId, {
      instanceName,
      brandTokens,
    });

    // Revalidate godmode pages
    revalidatePath('/godmode');

    return {
      ok: true,
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
    };
  } catch (err) {
    console.error('[godmode-brand-settings-error]', err);
    return { ok: false, error: 'Failed to save brand settings' };
  }
}

/**
 * Upload a tenant's logo (godmode only).
 * Accepts PNG, JPG, SVG up to 1MB.
 * Stores to S3 at tenants/{tenantId}/logo-{uuid}.{ext}
 */
export async function uploadTenantLogo(
  _prev: BrandSettingsState,
  formData: FormData,
): Promise<BrandSettingsState> {
  const platform = await getPlatformSession();
  if (!platform) {
    return { ok: false, error: 'Not authorized' };
  }

  const tenantId = String(formData.get('tenantId') ?? '').trim();
  if (!tenantId) {
    return { ok: false, error: 'Tenant ID is required' };
  }

  const logoFile = formData.get('logo');
  if (!logoFile || !(logoFile instanceof File) || logoFile.size === 0) {
    return { ok: false, error: 'No logo file provided' };
  }

  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(logoFile.type)) {
    return {
      ok: false,
      error: `Invalid file type: ${logoFile.type}. Allowed: PNG, JPG, SVG`,
    };
  }

  // Validate file size
  if (logoFile.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: `File too large: ${(logoFile.size / 1024 / 1024).toFixed(2)}MB. Max: 1MB`,
    };
  }

  // Get current tenant to verify it exists
  const repo = getTenantRepository();
  const tenant = await repo.get(tenantId);
  if (!tenant) {
    return { ok: false, error: 'Tenant not found' };
  }

  // Determine file extension from MIME type
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/svg+xml': 'svg',
  };
  const ext = extMap[logoFile.type] ?? 'png';

  // Generate asset ID with extension
  const assetId = `${randomUUID()}.${ext}`;
  const s3Key = `tenants/${tenantId}/logo-${assetId}`;

  try {
    // Upload to S3
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    // Bucket name includes account ID - see COLLABORATION.md and BenchAuthStack outputs
    const bucketName = process.env.ASSETS_BUCKET ?? 'bench-assets-771551874768';
    const region = process.env.AWS_REGION ?? 'eu-west-2';
    const s3 = new S3Client({ region });

    console.log('[logo-upload] Starting upload', { bucketName, s3Key, contentType: logoFile.type, size: logoFile.size });

    const fileBuffer = Buffer.from(await logoFile.arrayBuffer());
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: logoFile.type,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    console.log('[logo-upload] S3 upload complete, updating tenant');

    // Update tenant with new logo asset ID
    const { createTenantRepository, createClient } = await import('@bench/data');
    const tableName = process.env.BENCH_TABLE_NAME ?? 'bench-main';
    const client = createClient({ region });
    const extendedRepo = createTenantRepository(client, tableName);

    await extendedRepo.update(tenantId, {
      brandTokens: { logoAssetId: assetId },
    });

    // Revalidate pages
    revalidatePath('/godmode');

    console.log('[logo-upload] Complete', { assetId });
    return { ok: true, logoAssetId: assetId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorName = err instanceof Error ? err.name : 'Unknown';
    console.error('[godmode-logo-upload-error]', { errorName, errorMessage, err });
    return { ok: false, error: `Failed to upload logo: ${errorName}` };
  }
}

/**
 * Remove a tenant's logo (godmode only).
 * Sets logoAssetId to null.
 */
export async function removeTenantLogo(
  _prev: BrandSettingsState,
  formData: FormData,
): Promise<BrandSettingsState> {
  const platform = await getPlatformSession();
  if (!platform) {
    return { ok: false, error: 'Not authorized' };
  }

  const tenantId = String(formData.get('tenantId') ?? '').trim();
  if (!tenantId) {
    return { ok: false, error: 'Tenant ID is required' };
  }

  // Get current tenant to verify it exists
  const repo = getTenantRepository();
  const tenant = await repo.get(tenantId);
  if (!tenant) {
    return { ok: false, error: 'Tenant not found' };
  }

  try {
    // Update tenant to remove logo
    const { createTenantRepository, createClient } = await import('@bench/data');
    const tableName = process.env.BENCH_TABLE_NAME ?? 'bench-main';
    const client = createClient({ region: process.env.AWS_REGION ?? 'eu-west-2' });
    const extendedRepo = createTenantRepository(client, tableName);

    await extendedRepo.update(tenantId, {
      brandTokens: { logoAssetId: null },
    });

    // Revalidate pages
    revalidatePath('/godmode');

    return { ok: true };
  } catch (err) {
    console.error('[godmode-logo-remove-error]', err);
    return { ok: false, error: 'Failed to remove logo' };
  }
}
