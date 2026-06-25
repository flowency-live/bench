/**
 * Tenant status
 */
export type TenantStatus = 'active' | 'suspended' | 'trial';

/**
 * Brand tokens for a tenant
 */
export interface BrandTokens {
  readonly primaryColor: string;
  readonly accentColor: string;
  readonly gradientStart: string;
  readonly gradientMid: string;
  readonly gradientEnd: string;
  readonly headingFont: string;
  readonly bodyFont: string;
  readonly logoAssetId: string | null;
}

/**
 * Default brand tokens (used for new tenants)
 */
export const DEFAULT_BRAND_TOKENS: BrandTokens = {
  primaryColor: '#0a1929',
  accentColor: '#c5f82a',
  gradientStart: '#7ed321',
  gradientMid: '#00bcd4',
  gradientEnd: '#2196f3',
  headingFont: 'Oswald',
  bodyFont: 'Inter',
  logoAssetId: null,
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
