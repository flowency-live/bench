/**
 * BrandedWrapper component (ADR-0013)
 *
 * Wraps tenant-facing content with the tenant's brand tokens as CSS variables.
 * All existing `var(--color-*)` classes re-skin automatically.
 *
 * For pages that resolve tenant from session, call with no props.
 * For token-based pages (invite/share), pass the resolved tenant.
 */
import type { ReactNode } from 'react';
import type { Tenant } from '@bench/types';
import { brandStyle, getActiveBrand } from '@/lib/brand/resolve';

interface BrandedWrapperProps {
  children: ReactNode;
  /**
   * Explicit tenant for token-based pages (invite, share, claim).
   * If not provided, resolves from session.
   */
  tenant?: Tenant | null;
  /**
   * Additional classes for the wrapper div
   */
  className?: string;
}

/**
 * Server component that applies brand tokens to its children.
 */
export async function BrandedWrapper({
  children,
  tenant,
  className = '',
}: BrandedWrapperProps) {
  const brand = await getActiveBrand(tenant);
  const style = brandStyle(brand);

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
