import { notFound, redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { ProfileRenderer } from '@/components/ProfileRenderer';
import { getRepository } from '@/lib/data/repository';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';
import { ProfileActionBar } from './ProfileActionBar';
import { ShareLinkButton } from './ShareLinkButton';
import { SendInviteButton } from './SendInviteButton';
import { SendEditLinkButton } from './SendEditLinkButton';
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
        <ProfileActionBar
          profileId={profile.id}
          profileName={profile.name}
          profileStatus={profile.status}
          profileAvailability={profile.availability}
        >
          {/* Send invite: while profile is no_profile */}
          {profile.status === 'no_profile' && (
            <SendInviteButton
              profileId={profile.id}
              consultantName={profile.name}
            />
          )}

          {/* Edit link: for draft, active, or inactive profiles */}
          {(profile.status === 'draft' ||
            profile.status === 'active' ||
            profile.status === 'inactive') && (
            <SendEditLinkButton
              profileId={profile.id}
              consultantName={profile.name}
            />
          )}

          {/* Share link: only for active profiles */}
          {isActive && (
            <ShareLinkButton
              profileId={profile.id}
              consultantName={profile.name}
            />
          )}
        </ProfileActionBar>

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
