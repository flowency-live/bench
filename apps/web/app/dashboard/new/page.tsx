import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BrandedWrapper } from '@/components/BrandedWrapper';
import { AddConsultantForm } from '@/app/dashboard/new/AddConsultantForm';
import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';

export const dynamic = 'force-dynamic';

export default async function NewConsultantPage() {
  const session = await getSession();
  const tenantId = getTenantId(session);

  if (!tenantId) {
    redirect('/login');
  }

  const tenant = await getTenantRepository().get(tenantId);

  return (
    <BrandedWrapper tenant={tenant} className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-md px-6 py-12">
        <Link
          href="/dashboard"
          className="text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-accent)]"
        >
          ← Back to the Collective
        </Link>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Add a consultant</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Just a name and email gets them started. They complete their own profile
          through a guided invite link. You review and publish.
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
          <AddConsultantForm />
        </div>
      </main>
    </BrandedWrapper>
  );
}
