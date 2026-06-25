import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { AddConsultantForm } from '@/app/dashboard/new/AddConsultantForm';

export default function NewConsultantPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
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
          through a guided invite link — you review and publish.
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
          <AddConsultantForm />
        </div>
      </main>
    </div>
  );
}
