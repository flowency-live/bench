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
import { SendEditLinkButton } from './SendEditLinkButton';
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

            {/* Create PDF — opens the bare print page in a new tab and auto-fires
                the print dialog (owner saves as PDF). Orientation × theme; each
                lands on a single full-bleed page. */}
            <div className="flex flex-col gap-1 rounded-xl border border-[var(--color-accent)]/40 px-3 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                Create PDF
              </span>
              {(['dark', 'light'] as const).map((t) => (
                <div key={t} className="flex items-center gap-1">
                  <span className="w-10 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {t}
                  </span>
                  {(['portrait', 'landscape'] as const).map((orient) => (
                    <Link
                      key={orient}
                      href={`/profiles/${profile.id}/print?o=${orient}&theme=${t}`}
                      target="_blank"
                      rel="noopener"
                      className="rounded-full border border-[var(--color-accent)]/60 px-3 py-0.5 text-xs font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]"
                    >
                      {orient === 'portrait' ? 'Portrait' : 'Landscape'}
                    </Link>
                  ))}
                </div>
              ))}
            </div>

            {/* Send invite: while profile is no_profile. Mints a 14-day
                edit-scoped magic link the consultant uses to claim and build
                their own profile (moves no_profile → draft). */}
            {profile.status === 'no_profile' && (
              <SendInviteButton
                profileId={profile.id}
                consultantName={profile.name}
              />
            )}

            {/* Edit link: let a consultant who already has a record (draft,
                active, or deactivated) edit their own page (wizard). Does NOT
                change status, so an active profile stays published. */}
            {(profile.status === 'draft' ||
              profile.status === 'active' ||
              profile.status === 'inactive') && (
              <SendEditLinkButton
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

        <ProfileRenderer profile={profile} tenant={tenant} />

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
