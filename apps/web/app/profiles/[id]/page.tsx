import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { ProfileRenderer } from '@/components/ProfileRenderer';
import { getRepository } from '@/lib/data/repository';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';
import { ShareLinkButton } from './ShareLinkButton';
import { SendInviteButton } from './SendInviteButton';
import { StatusControls } from './StatusControls';
import { RatesPanel } from './RatesPanel';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) redirect('/login');

  const { id } = await params;
  const profile = await getRepository().get(tenantId, id);
  if (!profile) notFound();

  const tenant = await getTenantRepository().get(tenantId);
  const isActive = profile.status === 'active';
  const canInvite = profile.status === 'no_profile' || profile.status === 'in_progress';

  // Rates panel is only visible to tenant admins and platform admins
  const canViewRates = session?.kind === 'admin' || session?.kind === 'platform';

  return (
    <BrandedWrapper tenant={tenant} className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Owner toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-accent)]"
            >
              ← Collective
            </Link>
            <StatusControls
              profileId={profile.id}
              currentStatus={profile.status}
              currentAvailability={profile.availability}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/profiles/${profile.id}/edit`}
              className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              Edit profile
            </Link>

            {/* Create PDF — opens the bare print page in a new tab, which
                auto-fires the browser print dialog (owner saves as PDF). Two
                orientation choices keep it on-brand and one click each. */}
            <span className="flex items-center gap-1 rounded-full border border-[var(--color-accent)]/40 py-1 pl-3 pr-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                Create PDF
              </span>
              <Link
                href={`/profiles/${profile.id}/print?o=portrait`}
                target="_blank"
                rel="noopener"
                className="rounded-full border border-[var(--color-accent)]/60 px-3 py-1 text-xs font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
              >
                Portrait
              </Link>
              <Link
                href={`/profiles/${profile.id}/print?o=landscape`}
                target="_blank"
                rel="noopener"
                className="rounded-full border border-[var(--color-accent)]/60 px-3 py-1 text-xs font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
              >
                Landscape
              </Link>
            </span>

            {/* Send invite: while profile is no_profile or in_progress. Mints a
                14-day edit-scoped magic link the consultant uses to claim and
                build their own profile. */}
            {canInvite && (
              <SendInviteButton
                profileId={profile.id}
                consultantName={profile.name}
              />
            )}

            {/* Share link: only for active profiles. Mints a no-auth,
                view-only link to this one profile. */}
            {isActive && <ShareLinkButton profileId={profile.id} />}
          </div>
        </div>

        {isActive && (
          <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
            This is exactly what a client sees via a share link.
          </p>
        )}

        <ProfileRenderer profile={profile} />

        {/* Rates panel - admin only */}
        {canViewRates && (
          <div className="mt-8">
            <RatesPanel
              profileId={profile.id}
              rates={profile.ratesAndPreferences}
            />
          </div>
        )}
      </main>
    </BrandedWrapper>
  );
}
