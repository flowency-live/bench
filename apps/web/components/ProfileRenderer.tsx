import type { Profile } from '@/lib/types';
import type { Tenant } from '@bench/types';
import { TenantLogo } from '@/components/TenantLogo';

/**
 * The branded one-pager. Renders structured profile data through the tenant's
 * brand tokens (ADR-0013) — the same renderer powers the owner preview, the
 * client share view, and the print-to-PDF path. White-label: the chrome
 * (eyebrow + footer) reflects the supplied `tenant`, never a hardcoded brand.
 * When no tenant is available it degrades to a neutral "Bench" mark.
 */

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function BrandRing({ name, url }: { name: string; url: string | null }) {
  return (
    <div className="h-28 w-28 shrink-0 rounded-full ring-2 ring-[var(--color-accent)] ring-offset-4 ring-offset-[var(--color-bg-primary)]">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          className="h-full w-full rounded-full object-cover grayscale"
        />
      ) : (
        <div className="grid h-full w-full place-items-center rounded-full bg-[var(--color-bg-panel)] text-2xl font-black text-[var(--color-accent)]">
          {initials(name)}
        </div>
      )}
    </div>
  );
}

export function ProfileRenderer({
  profile,
  tenant,
}: {
  profile: Profile;
  /** Tenant whose brand frames the one-pager. Null → neutral Bench mark. */
  tenant?: Tenant | null;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
      {/* Identity */}
      <header className="flex flex-col gap-6 border-b border-[var(--color-border)] p-8 sm:flex-row sm:items-center">
        <BrandRing name={profile.name} url={profile.headshotUrl} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
            {tenant ? tenant.instanceName : 'Bench'}
          </p>
          <h1 className="mt-1 text-4xl font-black leading-tight text-[var(--color-text-primary)]">
            {profile.name}
          </h1>
          {profile.role && (
            <p className="mt-1 text-lg text-[var(--color-text-secondary)]">{profile.role}</p>
          )}
          {profile.headline && (
            <p className="mt-3 text-lg font-semibold text-[var(--color-accent)]">
              “{profile.headline}”
            </p>
          )}
        </div>
      </header>

      <div className="space-y-10 p-8">
        {/* Positioning */}
        {profile.bio && (
          <section>
            <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--color-text-primary)]">{profile.bio}</p>
          </section>
        )}

        {/* Core skills */}
        {profile.skills.length > 0 && (
          <section>
            <SectionTitle>Core skills</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...profile.skills]
                .sort((a, b) => a.order - b.order)
                .map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-panel)] p-4"
                  >
                    <p className="font-black text-[var(--color-text-primary)]">{s.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                      {s.body}
                    </p>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Impact stories */}
        {profile.stories.length > 0 && (
          <section>
            <SectionTitle>Impact</SectionTitle>
            <div className="space-y-4">
              {[...profile.stories]
                .sort((a, b) => a.order - b.order)
                .map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-panel)] p-5"
                  >
                    <span className="inline-block rounded-full bg-[var(--color-accent)]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                      {s.clientTag}
                    </span>
                    <p className="mt-3 font-black text-[var(--color-text-primary)]">{s.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-secondary)]">{s.body}</p>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Testimonial */}
        {profile.testimonial && (
          <section className="rounded-2xl border-l-4 border-[var(--color-accent)] bg-[var(--color-bg-panel)] p-6">
            <p className="text-lg italic leading-relaxed text-[var(--color-text-primary)]">
              “{profile.testimonial.quote}”
            </p>
            <p className="mt-3 text-sm font-semibold text-[var(--color-accent)]">
              {profile.testimonial.authorName}
              <span className="font-normal text-[var(--color-text-secondary)]">
                {' '}
                · {profile.testimonial.authorRole}, {profile.testimonial.authorCompany}
              </span>
            </p>
          </section>
        )}

        {profile.skills.length === 0 &&
          profile.stories.length === 0 &&
          !profile.bio && (
            <p className="text-center text-[var(--color-text-secondary)]">
              This profile hasn&rsquo;t been completed yet.
            </p>
          )}
      </div>

      <footer className="flex items-center justify-center gap-3 border-t border-[var(--color-border)] px-8 py-4 text-center text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
        {tenant ? (
          <TenantLogo tenant={tenant} size="sm" />
        ) : (
          <span className="font-bold text-[var(--color-accent)]">Bench</span>
        )}
      </footer>
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-[var(--color-text-primary)]">
      {children}
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </h2>
  );
}
