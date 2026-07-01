import { notFound, redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { WizardClient } from '@/app/profiles/[id]/edit/WizardClient';
import { getRepository } from '@/lib/data/repository';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';

export const dynamic = 'force-dynamic';

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  console.log('[EditProfilePage] Starting render...');

  try {
    const session = await getSession();
    console.log('[EditProfilePage] Got session:', session?.kind);

    const tenantId = getTenantId(session);
    console.log('[EditProfilePage] Tenant ID:', tenantId);
    if (!tenantId) redirect('/login');

    const { id } = await params;
    console.log('[EditProfilePage] Profile ID:', id);

    console.log('[EditProfilePage] Fetching profile...');
    const profile = await getRepository().get(tenantId, id);
    console.log('[EditProfilePage] Profile fetched:', profile ? 'found' : 'not found');
    console.log('[EditProfilePage] Profile headshotUrl:', profile?.headshotUrl);
    if (!profile) notFound();

    console.log('[EditProfilePage] Fetching tenant...');
    const tenant = await getTenantRepository().get(tenantId);
    console.log('[EditProfilePage] Tenant fetched:', tenant ? 'found' : 'not found');

    console.log('[EditProfilePage] Rendering page...');
    return (
      <BrandedWrapper tenant={tenant} className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-6 py-8">
          <WizardClient profile={profile} tenant={tenant} />
        </main>
      </BrandedWrapper>
    );
  } catch (error) {
    console.error('[EditProfilePage] ERROR during render:', error);
    console.error('[EditProfilePage] Error stack:', error instanceof Error ? error.stack : 'no stack');
    throw error;
  }
}
