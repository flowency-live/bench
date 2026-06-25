import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { ProfileRenderer } from '@/components/ProfileRenderer';
import { StatusBadge } from '@/components/StatusBadge';
import { changeStatus } from '@/app/actions';
import { getRepository } from '@/lib/data/repository';
import { PILOT_TENANT_ID } from '@/lib/tenant';
import { ShareLinkButton } from './ShareLinkButton';

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

            {/* Share link — only for published profiles. Mints a no-auth,
                view-only link to this one profile (server action), then shows the
                URL with a copy button. */}
            {isPublished && <ShareLinkButton profileId={profile.id} />}
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
