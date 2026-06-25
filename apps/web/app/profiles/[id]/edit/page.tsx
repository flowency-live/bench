import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { WizardClient } from '@/app/profiles/[id]/edit/WizardClient';
import { getRepository } from '@/lib/data/repository';
import { PILOT_TENANT_ID } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getRepository().get(PILOT_TENANT_ID, id);
  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <WizardClient profile={profile} />
      </main>
    </div>
  );
}
