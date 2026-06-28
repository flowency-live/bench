/**
 * TenantLogo component (ADR-0013)
 *
 * Renders the tenant's logo or falls back to an instanceName wordmark.
 * - If `logoAssetId` is present: render the logo from the assets CDN
 * - Otherwise: render a styled text wordmark using `instanceName`
 */
import type { Tenant } from '@bench/types';

const CLOUDFRONT_DOMAIN = process.env.ASSETS_CDN_DOMAIN ?? 'assets.bench.opstack.uk';

interface TenantLogoProps {
  tenant: Tenant;
  className?: string;
  /**
   * Size variant affects the logo dimensions and wordmark font size
   */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Size mappings for logo and wordmark
 */
const SIZE_CONFIG = {
  sm: {
    logoHeight: 24,
    wordmarkClass: 'text-base font-bold tracking-tight',
  },
  md: {
    logoHeight: 32,
    wordmarkClass: 'text-lg font-bold tracking-tight',
  },
  lg: {
    logoHeight: 48,
    wordmarkClass: 'text-2xl font-bold tracking-tight',
  },
} as const;

/**
 * Build the CDN URL for a logo asset.
 * Logos are stored under the tenant's path in the assets bucket.
 */
function getLogoUrl(tenantId: string, logoAssetId: string): string {
  // Logo assets are stored as: tenants/{tenantId}/logo-{assetId}.{ext}
  // For now assume PNG; could parse extension from assetId if needed
  return `https://${CLOUDFRONT_DOMAIN}/tenants/${tenantId}/logo-${logoAssetId}.png`;
}

/**
 * Render a tenant logo or wordmark fallback.
 *
 * @example
 * // With logo
 * <TenantLogo tenant={tenant} />
 *
 * @example
 * // Wordmark fallback (when no logoAssetId)
 * <TenantLogo tenant={{ ...tenant, logoAssetId: null }} />
 */
export function TenantLogo({ tenant, className = '', size = 'md' }: TenantLogoProps) {
  const config = SIZE_CONFIG[size];

  // Render logo if available
  if (tenant.brandTokens.logoAssetId) {
    const logoUrl = getLogoUrl(tenant.id, tenant.brandTokens.logoAssetId);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={tenant.instanceName}
        height={config.logoHeight}
        className={`h-auto ${className}`}
        style={{ height: config.logoHeight }}
      />
    );
  }

  // Fallback to text wordmark
  return (
    <span
      className={`${config.wordmarkClass} text-[var(--color-accent)] ${className}`}
      style={{ fontFamily: tenant.brandTokens.fontDisplay }}
    >
      {tenant.instanceName}
    </span>
  );
}
