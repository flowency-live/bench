import { notFound, redirect } from 'next/navigation';
import { ProfileRenderer } from '@/components/ProfileRenderer';
import { getRepository } from '@/lib/data/repository';
import { getSession, getTenantId } from '@/lib/auth/session';
import { PrintTrigger } from './PrintTrigger';
import { Logo } from '@/components/Logo';

export const dynamic = 'force-dynamic';

/**
 * Print-to-PDF view — bare branded one-pager (no app header/toolbar) sized to a
 * single A4 page, with the print dialog auto-opened so the owner just hits
 * "Save as PDF". Orientation comes from `?o=landscape|portrait` (default
 * portrait).
 *
 * NOTE: production upgrade is a server-side render — Lambda + headless Chromium
 * → S3 (PRD §12) — for a true one-click download with guaranteed embedded fonts
 * and consistent output across browsers. This browser-print path is the
 * immediate, zero-infra version.
 */
export default async function PrintProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ o?: string }>;
}) {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) redirect('/login');

  const { id } = await params;
  const { o } = await searchParams;
  const orientation = o === 'landscape' ? 'landscape' : 'portrait';

  const profile = await getRepository().get(tenantId, id);
  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] px-4 py-6 text-[var(--color-text-primary)] print:p-0">
      {/* Print sizing: one A4 page in the chosen orientation; the renderer keeps
          its navy fill edge-to-edge via print-color-adjust. */}
      <style>{`
        @page { size: A4 ${orientation}; margin: 12mm; }
        @media print {
          html, body {
            background: var(--color-bg-primary);
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-sheet { max-width: none; }
          /* Avoid awkward breaks mid-card. */
          section, article { break-inside: avoid; }
        }
      `}</style>

      <PrintTrigger />

      <div className="print-sheet mx-auto max-w-4xl">
        {/* Brand header so the printed PDF is clearly Change Connected. */}
        <div className="mb-6 flex items-center">
          <Logo className="h-8 w-auto" />
        </div>
        <ProfileRenderer profile={profile} />
      </div>
    </div>
  );
}
