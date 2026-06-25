import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { ProfileRenderer } from '@/components/ProfileRenderer';
import { StatusBadge } from '@/components/StatusBadge';
import { changeStatus } from '@/app/actions';
import { getRepository } from '@/lib/data/repository';
import { PILOT_TENANT_ID } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getRepository().get(PILOT_TENANT_ID, id);
  if (!profile) notFound();

  const canPublish = profile.status === 'submitted' || profile.status === 'draft';
  const isPublished = profile.status === 'published';

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
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
            <StatusBadge status={profile.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/profiles/${profile.id}/edit`}
              className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              Edit profile
            </Link>
            {isPublished && (
              <Link
                href={`/share/${profile.id}`}
                className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                Share view ↗
              </Link>
            )}
            {canPublish && (
              <form action={changeStatus}>
                <input type="hidden" name="profileId" value={profile.id} />
                <input type="hidden" name="status" value="published" />
                <button
                  type="submit"
                  className="rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-sm font-black uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-95"
                >
                  Publish
                </button>
              </form>
            )}
            {profile.status !== 'archived' && (
              <form action={changeStatus}>
                <input type="hidden" name="profileId" value={profile.id} />
                <input type="hidden" name="status" value="archived" />
                <button
                  type="submit"
                  className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white/60 transition hover:text-white"
                >
                  Archive
                </button>
              </form>
            )}
          </div>
        </div>

        {isPublished && (
          <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
            This is exactly what a client sees via a share link.
          </p>
        )}

        <ProfileRenderer profile={profile} />
      </main>
    </div>
  );
}
