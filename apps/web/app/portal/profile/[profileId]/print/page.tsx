import { notFound, redirect } from 'next/navigation';
import type { CSSProperties } from 'react';
import { ProfileRenderer } from '@/components/ProfileRenderer';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { getRepository } from '@/lib/data/repository';
import { getSession } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';
import { getClientRepository, getClientActivityRepository } from '@/lib/data/client';
import { PrintTrigger } from '@/app/profiles/[id]/print/PrintTrigger';

export const dynamic = 'force-dynamic';

/**
 * Portal print-to-PDF view.
 *
 * Same as the admin print page but:
 * - Validates client session and visibility
 * - Logs export activity
 */
export default async function PortalPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ o?: string; theme?: string }>;
}) {
  const session = await getSession();

  // Must be a client session
  if (!session || session.kind !== 'client') {
    redirect('/portal/error?reason=invalid');
  }

  const { tenantId, clientId, contactId, contactEmail } = session;
  const { profileId } = await params;
  const { o, theme } = await searchParams;
  const orientation = o === 'landscape' ? 'landscape' : 'portrait';
  const mode = theme === 'light' ? 'light' : 'dark';

  // Load client to check visibility
  const client = await getClientRepository().get(tenantId, clientId);
  if (!client) {
    redirect('/portal/error?reason=invalid');
  }

  // Load the profile
  const profile = await getRepository().get(tenantId, profileId);
  if (!profile) notFound();

  // Check profile is active
  if (profile.status !== 'active') {
    notFound();
  }

  // Check client has access to this profile
  if (client.visibilityMode === 'handpicked') {
    const allowed = new Set(client.handpickedProfileIds);
    if (!allowed.has(profileId)) {
      notFound();
    }
  }

  const tenant = await getTenantRepository().get(tenantId);

  // Log export activity (fire and forget)
  getClientActivityRepository()
    .log(tenantId, {
      clientId,
      contactId,
      contactEmail,
      profileId,
      eventType: 'export',
    })
    .catch(() => {
      // Non-critical, ignore errors
    });

  // A4 dimensions (full bleed, margin 0).
  const page =
    orientation === 'landscape'
      ? { w: '297mm', h: '210mm' }
      : { w: '210mm', h: '297mm' };

  // Light theme overrides the brand tokens.
  const lightVars = {
    '--color-bg-primary': '#ffffff',
    '--color-bg-panel': '#f3f4f6',
    '--color-text-primary': '#0b1220',
    '--color-text-secondary': '#475569',
    '--color-accent': '#1e293b',
    '--color-accent-2': '#334155',
    '--color-accent-grad': 'linear-gradient(120deg,#1e293b,#334155)',
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
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { background: var(--color-bg-primary); }
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
        @media screen {
          .pdf-root { display: flex; justify-content: center; background: #4b5563; padding: 24px; min-height: 100vh; }
          .pdf-page { box-shadow: 0 10px 40px rgba(0,0,0,0.45); }
        }
      `}</style>

      <PrintTrigger />

      <div className="pdf-page" style={sheetVars}>
        <div className="pdf-scale">
          <ProfileRenderer profile={profile} tenant={tenant} />
        </div>
      </div>
    </BrandedWrapper>
  );
}
