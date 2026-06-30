import type { Profile } from '@/lib/types';
import type { Tenant } from '@bench/types';
import { TenantLogo } from '@/components/TenantLogo';

/**
 * The branded one-pager — a dense, two-column "magazine" layout that fills the
 * page (header band, headline + bio full-width, then Core Skills + testimonial /
 * Impact Stories side by side, footer pinned to the bottom).
 *
 * Fully brand-token driven (ADR-0013): accent rules/bullets/chips use
 * `--color-accent`, text uses `--color-text-*`, hairlines `--color-border`, so it
 * works for any tenant and flips cleanly between the PDF light and dark themes.
 * The same renderer powers the owner preview, the client share view, and the
 * print-to-PDF sheet. With no tenant it degrades to a neutral "Bench" mark.
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

function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <div className="shrink-0 rounded-2xl bg-[image:var(--color-accent-grad)] p-[3px]">
      <div className="h-[84px] w-[84px] overflow-hidden rounded-[14px] bg-[var(--color-bg-panel)]">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="h-full w-full object-cover grayscale" />
        ) : (
          <div className="grid h-full w-full place-items-center text-2xl font-black text-[var(--color-accent)]">
            {initials(name)}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="h-1 w-6 shrink-0 rounded-full bg-[image:var(--color-accent-grad)]" />
      <h2 className="text-lg font-extrabold tracking-tight text-[var(--color-text-primary)]">
        {children}
      </h2>
    </div>
  );
}

function Item({
  chip,
  title,
  body,
}: {
  chip?: string;
  title: string;
  body: string;
}) {
  return (
    <div className="relative mb-2.5 border-b border-[var(--color-border)] pb-2.5 pl-[22px] last:mb-0 last:border-b-0 last:pb-0">
      <span className="absolute left-0 top-[6px] h-2.5 w-2.5 rounded-full bg-[image:var(--color-accent-grad)]" />
      {chip && (
        <span className="mb-1.5 inline-block rounded-full border border-[var(--color-accent)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-[var(--color-accent)]">
          {chip}
        </span>
      )}
      <h3 className="text-[13px] font-semibold leading-tight text-[var(--color-text-primary)]">
        {title}
      </h3>
      <p className="mt-1 text-[11px] font-light leading-snug text-[var(--color-text-secondary)]">
        {body}
      </p>
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
  const eyebrow = 'Consultant Profile';
  const sortedSkills = [...profile.skills].sort((a, b) => a.order - b.order);
  const sortedStories = [...profile.stories].sort((a, b) => a.order - b.order);
  const hasContent =
    sortedSkills.length > 0 || sortedStories.length > 0 || Boolean(profile.bio);

  return (
    <div
      className="relative bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
      style={{
        background:
          'radial-gradient(60% 42% at 84% -6%, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent 62%), radial-gradient(50% 40% at -6% 6%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 60%), var(--color-bg-primary)',
      }}
    >
      {/* Flowing ribbon (decorative). Stretches to fill in either orientation. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 794 1123"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M-40,120 C200,50 300,180 450,120 C600,70 700,185 834,135"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          opacity="0.22"
        />
        <path
          d="M-40,150 C200,235 300,88 450,150 C600,215 700,115 834,180"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.1"
          opacity="0.12"
        />
      </svg>

      <div className="relative z-10 flex flex-col px-10 py-9 sm:px-12">
        {/* Eyebrow */}
        <p className="mb-3 ml-0.5 text-[10.5px] font-semibold uppercase tracking-[0.34em] text-[var(--color-accent)]">
          {eyebrow}
        </p>

        {/* Identity + tenant mark */}
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-center gap-4">
            <Avatar name={profile.name} url={profile.headshotUrl} />
            <div className="min-w-0">
              <h1 className="text-[38px] font-extrabold leading-none tracking-tight text-[var(--color-text-primary)]">
                {profile.name}
              </h1>
              {profile.role && (
                <p className="mt-2 font-medium text-[var(--color-accent)]">{profile.role}</p>
              )}
            </div>
          </div>
          {tenant ? (
            <TenantLogo tenant={tenant} size="lg" className="shrink-0" />
          ) : (
            <span className="shrink-0 text-lg font-bold text-[var(--color-accent)]">Bench</span>
          )}
        </div>

        {/* Accent rule */}
        <div className="my-4 h-0.5 rounded-full bg-[image:var(--color-accent-grad)]" />

        {/* Headline + positioning */}
        {profile.headline && (
          <p className="mb-1.5 text-base font-semibold text-[var(--color-accent)]">
            {profile.headline}
          </p>
        )}
        {profile.bio && (
          <p className="text-[13px] font-light leading-relaxed text-[var(--color-text-secondary)]">
            {profile.bio}
          </p>
        )}

        {/* Two-column body */}
        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-7 md:grid-cols-2">
          {/* Left: Core skills + testimonial */}
          <section className="flex flex-col">
            {sortedSkills.length > 0 && (
              <>
                <SectionHead>Core Skills</SectionHead>
                {sortedSkills.map((s) => (
                  <Item key={s.id} title={s.title} body={s.body} />
                ))}
              </>
            )}

            {profile.testimonial && (
              <div className="relative mt-4 border-t border-[var(--color-border)] pt-4">
                <span className="absolute -top-2 left-0 font-serif text-5xl leading-none text-[var(--color-accent)] opacity-60">
                  &ldquo;
                </span>
                <p className="pl-8 text-[12px] font-light italic leading-relaxed text-[var(--color-text-primary)]">
                  {profile.testimonial.quote}
                </p>
                <div className="mt-2.5 flex items-center gap-2.5 pl-8">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[image:var(--color-accent-grad)]" />
                  <span className="text-[11.5px] text-[var(--color-text-secondary)]">
                    <b className="font-semibold text-[var(--color-text-primary)]">
                      {profile.testimonial.authorName}
                    </b>{' '}
                    &mdash; {profile.testimonial.authorRole}, {profile.testimonial.authorCompany}
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Right: Impact stories */}
          <section className="flex flex-col">
            {sortedStories.length > 0 && (
              <>
                <SectionHead>Impact Stories</SectionHead>
                {sortedStories.map((s) => (
                  <Item key={s.id} chip={s.clientTag} title={s.title} body={s.body} />
                ))}
              </>
            )}
          </section>
        </div>

        {!hasContent && (
          <p className="mt-8 text-center text-[var(--color-text-secondary)]">
            This profile hasn&rsquo;t been completed yet.
          </p>
        )}

        {/* Footer */}
        <footer className="mt-7 flex items-center justify-between gap-4 border-t border-[var(--color-border)] pt-3">
          {tenant ? (
            <TenantLogo tenant={tenant} size="sm" />
          ) : (
            <span className="text-sm font-bold text-[var(--color-accent)]">Bench</span>
          )}
          <span className="text-right text-[11px] font-light text-[var(--color-text-secondary)]">
            {tenant ? tenant.instanceName : 'An OpStack product'}
          </span>
        </footer>
      </div>
    </div>
  );
}
