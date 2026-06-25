/**
 * Tenant status
 */
export type TenantStatus = 'active' | 'suspended' | 'trial';

/**
 * Brand tokens for a tenant
 */
export interface BrandTokens {
  readonly bgPrimary: string;
  readonly bgPanel: string;
  readonly accent: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly fontDisplay: string;
  readonly fontBody: string;
  readonly logoAssetId: string | null;
}

/**
 * Default brand tokens - neutral platform default for new tenants.
 * Not tenant-specific; each tenant provides their own tokens on creation.
 */
export const DEFAULT_BRAND_TOKENS: BrandTokens = {
  bgPrimary: '#1a1a2e',
  bgPanel: '#16213e',
  accent: '#0f4c75',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0a0',
  fontDisplay: 'system-ui',
  fontBody: 'system-ui',
  logoAssetId: null,
};

/**
 * Change Connected brand tokens (Tenant #1 - pilot)
 * Source: live site changeconnected.co.uk, verified 2026-06-25 (ADR-0004)
 */
export const CHANGE_CONNECTED_BRAND_TOKENS: BrandTokens = {
  bgPrimary: '#001930',
  bgPanel: '#002e52',
  accent: '#baeb5b',
  textPrimary: '#ffffff',
  textSecondary: '#9dadc8',
  fontDisplay: 'Poppins',
  fontBody: 'Poppins',
  logoAssetId: null, // Set after logo asset is uploaded
};

/**
 * Tenant entity - represents a customer/organization
 */
export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly brandTokens: BrandTokens;
  readonly customDomain: string | null;
  readonly status: TenantStatus;
  readonly trialEndsAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Tenant summary for listing
 */
export interface TenantSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: TenantStatus;
  readonly customDomain: string | null;
}

/**
 * Create tenant request
 */
export interface CreateTenantRequest {
  readonly name: string;
  readonly slug: string;
  readonly brandTokens?: Partial<BrandTokens>;
  readonly customDomain?: string;
}
