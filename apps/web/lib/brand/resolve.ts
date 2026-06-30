/**
 * Brand resolution (ADR-0013)
 *
 * Resolves the active tenant from request context and returns its brand tokens.
 * Brand-resolution order:
 * 1. Explicit tenant passed (token-based pages like invite/share)
 * 2. Logged-in session → session.tenantId (platform → activeTenantId)
 * 3. None → BENCH_DEFAULT_BRAND (generic /login, marketing)
 */
import type { CSSProperties } from 'react';
import type { BrandTokens, Tenant } from '@bench/types';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';

/**
 * Default Bench brand for the generic login and marketing pages.
 * Neutral platform default when no tenant context exists.
 */
export const BENCH_DEFAULT_BRAND: BrandTokens = {
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
 * Get the active tenant from session or explicit parameter.
 *
 * @param explicitTenant - Optional tenant already resolved (from token-based pages)
 * @returns The tenant or null if no tenant context
 */
export async function getActiveTenant(
  explicitTenant?: Tenant | null
): Promise<Tenant | null> {
  // If an explicit tenant was passed (e.g., from invite/share token resolution),
  // use it directly - no session lookup needed
  if (explicitTenant) {
    return explicitTenant;
  }

  // Resolve from session
  const session = await getSession();
  const tenantId = getTenantId(session);

  if (!tenantId) {
    return null;
  }

  const repo = getTenantRepository();
  return repo.get(tenantId);
}

/**
 * Get the active brand tokens from session or explicit tenant.
 *
 * @param explicitTenant - Optional tenant already resolved (from token-based pages)
 * @returns The brand tokens (tenant's or BENCH_DEFAULT_BRAND)
 */
export async function getActiveBrand(
  explicitTenant?: Tenant | null
): Promise<BrandTokens> {
  const tenant = await getActiveTenant(explicitTenant);
  return tenant?.brandTokens ?? BENCH_DEFAULT_BRAND;
}

/** WCAG relative luminance of a #rrggbb (or #rgb) colour. */
function relLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const ch = (i: number) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}

/**
 * Pick the foreground (text) colour that reads best ON a given background —
 * white or near-black, whichever gives higher contrast. Used so an accent
 * button is always legible regardless of the tenant's accent (WCAG, ADR-0013).
 */
export function readableOn(hex: string): string {
  try {
    const L = relLuminance(hex);
    const onWhite = 1.05 / (L + 0.05);
    const onBlack = (L + 0.05) / 0.05;
    return onWhite >= onBlack ? '#ffffff' : '#0a0a0a';
  } catch {
    return '#ffffff';
  }
}

/**
 * Map BrandTokens to CSS custom properties for inline styling.
 *
 * Apply as `style` on the tenant surface wrapper - existing `var(--color-*)`
 * classes re-skin with no per-component edits (same technique as .flowency-godmode).
 * Also derives `--color-accent-foreground` (a legible text colour on the accent)
 * so accent buttons stay WCAG AA for any tenant accent.
 *
 * @param tokens - The brand tokens to convert
 * @returns CSS properties object suitable for React style prop
 */
export function brandStyle(tokens: BrandTokens): CSSProperties {
  // Optional second accent → an accent→accentSecondary gradient for decorative
  // fills. Falls back to a solid accent (a same-stop gradient) when not set.
  const accent2 = tokens.accentSecondary || tokens.accent;
  return {
    '--color-bg-primary': tokens.bgPrimary,
    '--color-bg-panel': tokens.bgPanel,
    '--color-accent': tokens.accent,
    '--color-accent-2': accent2,
    '--color-accent-grad': `linear-gradient(120deg, ${tokens.accent}, ${accent2})`,
    '--color-accent-foreground': readableOn(tokens.accent),
    '--color-text-primary': tokens.textPrimary,
    '--color-text-secondary': tokens.textSecondary,
    '--font-display': tokens.fontDisplay,
    '--font-body': tokens.fontBody,
  } as CSSProperties;
}
