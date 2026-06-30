import { notFound, redirect } from 'next/navigation';
import type { CSSProperties } from 'react';
import { ProfileRenderer } from '@/components/ProfileRenderer';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { TenantLogo } from '@/components/TenantLogo';
import { getRepository } from '@/lib/data/repository';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';
import { PrintTrigger } from './PrintTrigger';

export const dynamic = 'force-dynamic';

/**
 * Print-to-PDF view — a single, full-bleed A4 page.
 *
 * - `?o=landscape|portrait` (default portrait) sets the page orientation.
 * - `?theme=light|dark` (default dark) picks the colour scheme. Dark uses the
 *   tenant brand as-is; light overrides the brand tokens to a paper-friendly
 *   scheme so the renderer (now fully token-driven) flips cleanly.
 *
 * Full bleed: `@page { margin: 0 }` + the renderer's card border/radius removed
 * so the background reaches every edge. Single page: `PrintTrigger` measures the
 * content and scales it to fit one page. No `min-h-screen`, so there is no blank
 * leading page.
 *
 * NOTE: this is still the browser print path. A true attachable .pdf (server-side
 * Lambda + headless Chromium → S3) is the planned follow-up.
 */
export default async function PrintProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ o?: string; theme?: string }>;
}) {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) redirect('/login');

  const { id } = await params;
  const { o, theme } = await searchParams;
  const orientation = o === 'landscape' ? 'landscape' : 'portrait';
  const mode = theme === 'light' ? 'light' : 'dark';

  const profile = await getRepository().get(tenantId, id);
  if (!profile) notFound();

  const tenant = await getTenantRepository().get(tenantId);

  // A4 dimensions (full bleed, margin 0).
  const page =
    orientation === 'landscape'
      ? { w: '297mm', h: '210mm' }
      : { w: '210mm', h: '297mm' };

  // Light theme overrides the brand tokens on the sheet (most specific wins).
  // Dark only needs a darker hairline default than :root provides on a navy card.
  const lightVars = {
    '--color-bg-primary': '#ffffff',
    '--color-bg-panel': '#f3f4f6',
    '--color-text-primary': '#0b1220',
    '--color-text-secondary': '#475569',
    '--color-accent': '#1e293b',
    '--color-accent-foreground': '#ffffff',
    '--color-border': 'rgba(0,0,0,0.12)',
  } as CSSProperties;
  const sheetVars: CSSProperties | undefined = mode === 'light' ? lightVars : undefined;

  return (
    <BrandedWrapper tenant={tenant} className="pdf-root">
      <style>{`
        @page { size: A4 ${orientation}; margin: 0; }
        html, body { margin: 0; padding: 0; background: var(--color-bg-primary); }
        @media print {
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .pdf-page {
          width: ${page.w};
          height: ${page.h};
          box-sizing: border-box;
          overflow: hidden;
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
        }
        .pdf-scale { transform-origin: top left; width: 100%; }
        .pdf-pad { padding: 14mm; }
        /* Full bleed: the renderer must not carry a card border/radius in the PDF. */
        .pdf-page article {
          border: none !important;
          border-radius: 0 !important;
          background: transparent !important;
        }
        @media screen {
          .pdf-root { display: flex; justify-content: center; background: #4b5563; padding: 24px; min-height: 100vh; }
          .pdf-page { box-shadow: 0 10px 40px rgba(0,0,0,0.45); }
        }
      `}</style>

      <PrintTrigger />

      <div className="pdf-page" style={sheetVars}>
        <div className="pdf-scale">
          <div className="pdf-pad">
            <div className="mb-6 flex items-center justify-between">
              {tenant ? (
                <TenantLogo tenant={tenant} size="md" />
              ) : (
                <span className="text-lg font-bold text-[var(--color-accent)]">Bench</span>
              )}
            </div>
            <ProfileRenderer profile={profile} tenant={tenant} />
          </div>
        </div>
      </div>
    </BrandedWrapper>
  );
}
