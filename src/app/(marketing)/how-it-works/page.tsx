import type { Metadata } from 'next';
import { ButtonLink, Card, Eyebrow, SectionHeading } from '@/components/ui';
import { STAGES } from '@/lib/brand';
import { STATUS_LABELS } from '@/lib/workflow';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Discover, Develop, Publish, Archive, Adapt, Commercialize: the six-stage journey a story takes through the DPGLF ecosystem.',
};

/** The writer-visible slice of the submission state machine. */
const JOURNEY: { status: keyof typeof STATUS_LABELS; who: string; what: string }[] = [
  { status: 'DRAFT', who: 'You', what: 'Start an entry, add your story details and upload the manuscript.' },
  { status: 'SUBMITTED', who: 'You', what: 'Submit before the deadline and receive an immutable reference number.' },
  { status: 'ELIGIBILITY_REVIEW', who: 'Programme admin', what: 'Your entry is checked against the rules: age, length, format, consent.' },
  { status: 'ASSIGNED_FOR_JUDGING', who: 'Judges', what: 'Assigned readers score against a published rubric, without seeing who you are.' },
  { status: 'SHORTLISTED', who: 'Foundation', what: 'Results are finalised and every entrant is told the outcome.' },
  { status: 'MENTORSHIP', who: 'Your mentor', what: 'You revise with an established writer or editor; every draft is kept.' },
  { status: 'EDITORIAL', who: 'Editors', what: 'The story is prepared to a publishable standard.' },
  { status: 'PUBLISHED', who: 'Foundation', what: 'The story is published, credited to you, and preserved in the archive.' },
];

const AUDIENCES = [
  {
    title: 'Writers',
    body: 'Enter competitions, track your submission, work with a mentor and build a public author profile.',
    cta: { href: '/submit', label: 'Submit a story' },
  },
  {
    title: 'Mentors & judges',
    body: 'Give structured feedback or score against a rubric, with only your assigned work visible to you.',
    cta: { href: '/contact?topic=general', label: 'Offer to help' },
  },
  {
    title: 'Schools',
    body: 'Bring a writing programme to your students, with classroom-ready material from the archive.',
    cta: { href: '/contact?topic=schools', label: 'Talk to us about schools' },
  },
  {
    title: 'Publishers & producers',
    body: 'Browse permitted archive content and register interest in adaptation-ready intellectual property.',
    cta: { href: '/partners', label: 'Partner with us' },
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="texture-weave bg-forest-950">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="max-w-3xl">
            <Eyebrow className="text-gold-400">The journey</Eyebrow>
            <h1 className="font-display mt-4 text-4xl leading-tight font-semibold text-balance text-bone sm:text-5xl">
              Discover → Develop → Publish → Archive → Adapt → Commercialize
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-bone/75">
              Every successful creative industry has a pipeline. This is ours: six connected
              stages, each with a purpose of its own and each reinforcing the next.
            </p>
          </div>
        </div>
      </section>

      {/* ---- the six stages in detail ------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <ol className="space-y-16">
          {STAGES.map((stage, i) => (
            <li key={stage.key} className="grid gap-8 lg:grid-cols-[auto_1fr] lg:gap-14">
              <div className="flex items-start gap-5 lg:w-52 lg:flex-col lg:gap-3">
                <span
                  aria-hidden
                  className="font-display grid size-16 shrink-0 place-items-center rounded-full border border-gold-500/50 text-xl font-semibold text-gold-700"
                >
                  {stage.number}
                </span>
                <div>
                  <h2 className="font-display text-2xl font-semibold text-forest-900">{stage.name}</h2>
                  {i < STAGES.length - 1 && (
                    <div aria-hidden className="mt-4 hidden h-16 w-px bg-line lg:ml-8 lg:block" />
                  )}
                </div>
              </div>
              <div className="max-w-3xl">
                <p className="font-display text-xl leading-snug text-forest-800">{stage.headline}</p>
                <p className="mt-4 leading-relaxed text-muted">{stage.blurb}</p>
                <p className="mt-3 leading-relaxed text-muted">{stage.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- writer journey ------------------------------------------------------- */}
      <section className="bg-parchment py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading
            eyebrow="For writers"
            title="What actually happens to your story"
            lead="Your submission has a status at every moment, and you can see it. Nothing is decided in a spreadsheet you cannot look at."
          />
          <ol className="mt-14 overflow-hidden rounded-2xl border border-line bg-white">
            {JOURNEY.map((step, i) => (
              <li
                key={step.status}
                className="grid gap-2 border-b border-line px-6 py-5 last:border-0 sm:grid-cols-[10rem_9rem_1fr] sm:items-baseline sm:gap-6"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-sm text-gold-600">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-semibold text-forest-900">{STATUS_LABELS[step.status]}</span>
                </div>
                <span className="text-xs tracking-wider text-muted uppercase">{step.who}</span>
                <span className="text-sm leading-relaxed text-muted">{step.what}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted">
            Writers under eighteen also need a parent or guardian to give consent before an entry
            can be judged. We ask for the minimum information needed to establish eligibility, and
            consent can be withdrawn at any time.
          </p>
        </div>
      </section>

      {/* ---- audiences ------------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <SectionHeading eyebrow="Join the ecosystem" title="Where you fit" align="center" />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((a) => (
            <Card key={a.title} className="flex flex-col p-6">
              <h3 className="font-display text-lg font-semibold text-forest-900">{a.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{a.body}</p>
              <ButtonLink href={a.cta.href} variant="outline" size="sm" className="mt-5 self-start">
                {a.cta.label}
              </ButtonLink>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
