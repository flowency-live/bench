import Link from 'next/link';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { BenchMark } from '@/components/BenchMark';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Bench public landing / marketing page (bench.opstack.uk root).
 *
 * Bench is an OpStack product, so this carries the OpStack brand family
 * (deep navy + purple/violet gradients + amber highlight, Plus Jakarta Sans) —
 * NOT a tenant's brand. Scoped to `.bench-landing` (see globals.css).
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const CONTACT_EMAIL = 'hello@opstack.uk';

export default async function HomePage() {
  const session = await getSession();
  const signedIn = session != null;

  return (
    <div className={`${jakarta.variable} bench-landing min-h-screen`}>
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-[var(--b-border)]/60 bg-[#060d23]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <BenchMark />
          <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--b-muted)] md:flex">
            <a href="#features" className="transition hover:text-white">What it does</a>
            <a href="#how" className="transition hover:text-white">How it works</a>
            <a href="#contact" className="transition hover:text-white">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            {signedIn ? (
              <Link href="/dashboard" className="b-btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="b-btn-ghost rounded-lg px-4 py-2 text-sm font-semibold">
                  Sign in
                </Link>
                <a href="#contact" className="b-btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
                  Get started
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 text-center">
        <p className="text-[12px] font-bold uppercase tracking-[0.28em] text-[var(--b-purple)]">
          The talent platform for consultancies
        </p>
        <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          Your bench, <span className="b-grad-text">presented properly.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--b-muted)]">
          Bench turns your consultants into branded, always-current profiles &mdash; built by them,
          shared by you, in front of the right clients. No more hand-built decks or chasing CVs.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <a href="#contact" className="b-btn-primary rounded-xl px-7 py-3.5 text-sm font-bold uppercase tracking-wide">
            Get started
          </a>
          <Link href="/login" className="b-btn-ghost rounded-xl px-7 py-3.5 text-sm font-bold uppercase tracking-wide">
            Sign in
          </Link>
        </div>

        {/* Hero glow card */}
        <div className="mx-auto mt-16 max-w-3xl">
          <div className="b-card rounded-2xl p-2 shadow-[0_0_80px_rgba(94,68,228,0.18)]">
            <div className="rounded-xl border border-[var(--b-border)] bg-[#0a1230] p-6 text-left">
              <div className="flex items-center justify-between border-b border-[var(--b-border)] pb-4">
                <span className="text-sm font-bold">The Collective</span>
                <span className="rounded-full bg-[var(--b-purple)]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--b-purple)]">
                  4 consultants
                </span>
              </div>
              <ul className="mt-4 space-y-3">
                {[
                  ['Priya Nair', 'Change & Transformation Lead', 'Available', '#34d399'],
                  ['Marcus Hale', 'Delivery Director', 'Looking · 1 month', '#f59e0b'],
                  ['Oliver Bradley', 'Founder', 'Engaged · roll-off Sept', '#8570eb'],
                ].map(([name, role, avail, dot]) => (
                  <li key={name} className="flex items-center justify-between gap-4 rounded-lg bg-white/[0.02] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="truncate text-xs text-[var(--b-muted)]">{role}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-[var(--b-muted)]">
                      <span className="h-2 w-2 rounded-full" style={{ background: dot as string }} />
                      {avail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Everything your bench needs, in one place
          </h2>
          <p className="mt-4 text-[var(--b-muted)]">
            Structured profiles, your brand, and controlled sharing &mdash; so presenting your people
            takes minutes, not hours.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Profiles that build themselves', 'Send a consultant a single link. They complete a guided wizard. You stop transcribing CVs into slides.'],
            ['On-brand by construction', 'Every profile renders in your colours, logo and fonts. White-label, end to end.'],
            ['Share with control', 'Put one profile in front of one client via an expiring, revocable link. See when it is opened.'],
            ['One source of truth', 'Update once and every shared link reflects it. Track availability across your whole bench.'],
          ].map(([title, body]) => (
            <div key={title} className="b-card rounded-2xl p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--b-purple)]/15 text-[var(--b-purple)]">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-[#5e44e4] to-[#b152e0]" />
              </div>
              <h3 className="text-base font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--b-muted)]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.28em] text-[var(--b-purple)]">How it works</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Up and running in three steps</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            ['01', 'Add a consultant', 'Name and email is all it takes. Bench creates their place on your bench.'],
            ['02', 'They complete their profile', 'A guided wizard with prompts and live preview. No accounts, no friction.'],
            ['03', 'Share with a client', 'Generate a branded, expiring link for a specific client. Update any time.'],
          ].map(([n, title, body]) => (
            <div key={n} className="b-card rounded-2xl p-7">
              <span className="b-grad-text text-3xl font-extrabold">{n}</span>
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--b-muted)]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band + Contact */}
      <section id="contact" className="mx-auto max-w-6xl px-6 py-20">
        <div className="b-card overflow-hidden rounded-3xl p-10 text-center sm:p-14"
             style={{ background: 'linear-gradient(135deg, rgba(94,68,228,0.18), rgba(177,82,224,0.12))' }}>
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ready to present your bench <span className="b-grad-text">properly?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--b-muted)]">
            Bench is invite-only during our pilot. Tell us about your consultancy and we will get you set up.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href={`mailto:${CONTACT_EMAIL}?subject=Bench%20access`} className="b-btn-primary rounded-xl px-7 py-3.5 text-sm font-bold uppercase tracking-wide">
              Contact us
            </a>
            <Link href="/login" className="b-btn-ghost rounded-xl px-7 py-3.5 text-sm font-bold uppercase tracking-wide">
              Sign in
            </Link>
          </div>
          <p className="mt-5 text-sm text-[var(--b-muted)]">
            Or email <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[var(--b-purple)] hover:underline">{CONTACT_EMAIL}</a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--b-border)]/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-[var(--b-muted)] sm:flex-row">
          <BenchMark className="text-[var(--b-text)]" />
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/login" className="transition hover:text-white">Sign in</Link>
            <a href="#contact" className="transition hover:text-white">Contact</a>
            <a href="https://www.opstack.uk" target="_blank" rel="noopener" className="transition hover:text-white">
              An OpStack product
            </a>
          </div>
          <p className="text-xs">&copy; {new Date().getFullYear()} OpStack</p>
        </div>
      </footer>
    </div>
  );
}
