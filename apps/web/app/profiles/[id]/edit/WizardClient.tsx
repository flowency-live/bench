'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProfileRenderer } from '@/components/ProfileRenderer';
import { HeadshotUpload } from '@/components/HeadshotUpload';
import { saveProfile, submitForReview } from '@/app/actions';
import type { Tenant } from '@bench/types';
import type {
  Profile,
  Skill,
  Story,
  Testimonial,
} from '@/lib/types';

// Rates are managed separately by tenant admins, not part of consultant profile wizard
const STEPS = ['Identity', 'Positioning', 'Skills', 'Impact', 'Testimonial', 'Review'] as const;
const uid = () => Math.random().toString(36).slice(2, 9);

const field =
  'w-full rounded-lg border border-white/15 bg-[var(--color-bg-primary)] px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-[var(--color-accent)]';
const label =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]';
const help = 'mt-1.5 text-xs text-white/40';

export function WizardClient({
  profile,
  tenant,
}: {
  profile: Profile;
  tenant?: Tenant | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.role ?? '');
  const [headshotUrl, setHeadshotUrl] = useState(profile.headshotUrl ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [headline, setHeadline] = useState(profile.headline ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [skills, setSkills] = useState<Skill[]>(profile.skills.map((s) => ({ ...s })));
  const [stories, setStories] = useState<Story[]>(profile.stories.map((s) => ({ ...s })));
  const [hasTestimonial, setHasTestimonial] = useState(Boolean(profile.testimonial));
  const [testimonial, setTestimonial] = useState<Testimonial>(
    profile.testimonial ?? { quote: '', authorName: '', authorRole: '', authorCompany: '' },
  );

  // Rates are managed separately by tenant admins - not included in wizard patch
  const buildPatch = () => ({
    name: name.trim(),
    role: role.trim() || null,
    headshotUrl: headshotUrl.trim() || null,
    headline: headline.trim() || null,
    bio: bio.trim() || null,
    skills: skills.map((s, i) => ({ ...s, order: i })),
    stories: stories.map((s, i) => ({ ...s, order: i })),
    testimonial: hasTestimonial && testimonial.quote.trim() ? testimonial : null,
  });

  const preview: Profile = {
    ...profile,
    name,
    role: role || null,
    headshotUrl: headshotUrl || null,
    headline: headline || null,
    bio: bio || null,
    skills: skills.map((s, i) => ({ ...s, order: i })),
    stories: stories.map((s, i) => ({ ...s, order: i })),
    testimonial: hasTestimonial && testimonial.quote ? testimonial : null,
  };

  const save = (then?: () => void) =>
    start(async () => {
      setSaveError(null);
      const patch = buildPatch();
      console.log('[WizardClient] Saving with patch:', JSON.stringify(patch, null, 2));
      const result = await saveProfile(profile.id, patch);
      if (!result.success) {
        console.error('[WizardClient] Save error:', result.error);
        setSaveError(`Save failed: ${result.error}`);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString('en-GB'));
      then?.();
    });

  const next = () => save(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const saveOnly = () => save();
  const saveAndExit = () => save(() => router.push(`/profiles/${profile.id}`));
  const submit = () =>
    start(async () => {
      await saveProfile(profile.id, buildPatch());
      await submitForReview(profile.id);
      router.push(`/profiles/${profile.id}`);
    });

  const wordCount = bio.trim() ? bio.trim().split(/\s+/).length : 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/profiles/${profile.id}`}
          className="text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-accent)]"
        >
          ← Back to profile
        </Link>
        <span className="text-xs text-white/40">
          {pending ? 'Saving…' : saveError ? (
            <span className="text-red-400">{saveError}</span>
          ) : savedAt ? `Saved ${savedAt}` : 'Auto-saves as you go'}
        </span>
      </div>

      {/* Stepper */}
      <ol className="mb-8 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => save(() => setStep(i))}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                i === step
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : i < step
                    ? 'bg-white/10 text-white'
                    : 'bg-white/5 text-white/40'
              }`}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
        {step === 0 && (
          <Section title="Identity" intro="Your name and the role line shown at the top of your profile.">
            <Labeled label="Full name">
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
            </Labeled>
            <Labeled label="Role / strapline">
              <input
                className={field}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Change &amp; Transformation Lead"
              />
            </Labeled>
            <Labeled label="Profile photo">
              <HeadshotUpload
                currentUrl={headshotUrl || null}
                profileId={profile.id}
                onUploadComplete={(url) => setHeadshotUrl(url)}
              />
            </Labeled>
          </Section>
        )}

        {step === 1 && (
          <Section title="Positioning" intro="A punchy headline and a short bio in your own words.">
            <Labeled label="Headline">
              <input
                className={field}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Driving value from strategy to execution"
              />
            </Labeled>
            <Labeled label="Bio">
              <textarea
                className={`${field} min-h-32`}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="40–70 words. What you do, who for, and the difference you make."
              />
              <p className={help}>
                {wordCount} words{' '}
                {wordCount > 0 && (wordCount < 40 || wordCount > 70) ? '· aim for 40–70' : ''}
              </p>
            </Labeled>
          </Section>
        )}

        {step === 2 && (
          <Section title="Core skills" intro="3–6 skills, each a short title and a sentence or two.">
            <div className="space-y-4">
              {skills.map((s) => (
                <div key={s.id} className="rounded-lg border border-white/10 p-4">
                  <input
                    className={`${field} mb-2`}
                    value={s.title}
                    onChange={(e) =>
                      setSkills((a) => a.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))
                    }
                    placeholder="Skill title"
                  />
                  <textarea
                    className={`${field} min-h-20`}
                    value={s.body}
                    onChange={(e) =>
                      setSkills((a) => a.map((x) => (x.id === s.id ? { ...x, body: e.target.value } : x)))
                    }
                    placeholder="One or two sentences."
                  />
                  <button
                    type="button"
                    onClick={() => setSkills((a) => a.filter((x) => x.id !== s.id))}
                    className="mt-2 text-xs text-white/40 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {skills.length < 6 && (
              <AddButton onClick={() => setSkills((a) => [...a, { id: uid(), title: '', body: '', order: a.length }])}>
                + Add skill
              </AddButton>
            )}
          </Section>
        )}

        {step === 3 && (
          <Section title="Impact" intro="3–5 results. Lead with a client/context tag and a number where you can.">
            <div className="space-y-4">
              {stories.map((s) => (
                <div key={s.id} className="rounded-lg border border-white/10 p-4">
                  <input
                    className={`${field} mb-2`}
                    value={s.clientTag}
                    onChange={(e) =>
                      setStories((a) => a.map((x) => (x.id === s.id ? { ...x, clientTag: e.target.value } : x)))
                    }
                    placeholder="Client / context tag (e.g. Aviation)"
                  />
                  <input
                    className={`${field} mb-2`}
                    value={s.title}
                    onChange={(e) =>
                      setStories((a) => a.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))
                    }
                    placeholder="Outcome title (e.g. ten hours → two seconds)"
                  />
                  <textarea
                    className={`${field} min-h-20`}
                    value={s.body}
                    onChange={(e) =>
                      setStories((a) => a.map((x) => (x.id === s.id ? { ...x, body: e.target.value } : x)))
                    }
                    placeholder="One to three sentences on the result."
                  />
                  <button
                    type="button"
                    onClick={() => setStories((a) => a.filter((x) => x.id !== s.id))}
                    className="mt-2 text-xs text-white/40 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {stories.length < 5 && (
              <AddButton
                onClick={() =>
                  setStories((a) => [...a, { id: uid(), clientTag: '', title: '', body: '', order: a.length }])
                }
              >
                + Add impact story
              </AddButton>
            )}
          </Section>
        )}

        {step === 4 && (
          <Section title="Testimonial" intro="Optional. A short quote with attribution.">
            <label className="mb-4 flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={hasTestimonial}
                onChange={(e) => setHasTestimonial(e.target.checked)}
              />
              Include a testimonial
            </label>
            {hasTestimonial && (
              <div className="space-y-3">
                <textarea
                  className={`${field} min-h-24`}
                  value={testimonial.quote}
                  onChange={(e) => setTestimonial((t) => ({ ...t, quote: e.target.value }))}
                  placeholder="The quote."
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    className={field}
                    value={testimonial.authorName}
                    onChange={(e) => setTestimonial((t) => ({ ...t, authorName: e.target.value }))}
                    placeholder="Name"
                  />
                  <input
                    className={field}
                    value={testimonial.authorRole}
                    onChange={(e) => setTestimonial((t) => ({ ...t, authorRole: e.target.value }))}
                    placeholder="Role"
                  />
                  <input
                    className={field}
                    value={testimonial.authorCompany}
                    onChange={(e) => setTestimonial((t) => ({ ...t, authorCompany: e.target.value }))}
                    placeholder="Company"
                  />
                </div>
              </div>
            )}
          </Section>
        )}

        {step === 5 && (
          <Section title="Review &amp; submit" intro="This is exactly how your profile will look.">
            <div className="-mx-2">
              <ProfileRenderer profile={preview} tenant={tenant} />
            </div>
          </Section>
        )}
      </div>

      {/* Nav - stacks on mobile, inline on desktop */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={back}
            disabled={step === 0}
            className="flex-1 rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:text-white disabled:opacity-30 sm:flex-none sm:px-5 sm:py-2"
          >
            Back
          </button>
          <button
            type="button"
            onClick={saveAndExit}
            disabled={pending}
            className="flex-1 rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:text-white disabled:opacity-60 sm:flex-none sm:px-5 sm:py-2"
          >
            Save &amp; exit
          </button>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {step < STEPS.length - 1 ? (
            <>
              <button
                type="button"
                onClick={saveOnly}
                disabled={pending}
                className="flex-1 rounded-full border border-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)]/10 disabled:opacity-60 sm:flex-none sm:px-5 sm:py-2"
              >
                Save
              </button>
              <button
                type="button"
                onClick={next}
                disabled={pending}
                className="flex-1 rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-95 disabled:opacity-60 sm:flex-none sm:px-6 sm:py-2"
              >
                Continue
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="w-full rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-95 disabled:opacity-60 sm:w-auto sm:px-6 sm:py-2"
            >
              {pending ? 'Submitting…' : 'Submit for review'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xl font-black text-white">{title}</h2>
      <p className="mb-5 mt-1 text-sm text-[var(--color-text-secondary)]">{intro}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Labeled({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={label}>{text}</span>
      {children}
    </div>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full rounded-lg border border-dashed border-white/20 py-2.5 text-sm font-semibold text-[var(--color-accent)] transition hover:border-[var(--color-accent)]"
    >
      {children}
    </button>
  );
}
