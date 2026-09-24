import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, ButtonLink, Card, DescList, Eyebrow, SectionHeading } from '@/components/ui';
import { deadlineLabel, formatDate, formatNumber } from '@/lib/format';
import { competitionBySlug } from '@/features/marketing/queries';

/** Fallback copy for Tales from the Baobab before an admin has authored the record. */
const BAOBAB_FALLBACK = {
  name: 'Tales from the Baobab',
  tagline:
    'An annual Afrocentric short story competition for writers under eighteen, from Zimbabwe, across Africa and the global African diaspora.',
  themes: [
    'African history',
    'Cultural heritage',
    'Traditional knowledge',
    'Contemporary social realities',
    'Innovation and entrepreneurship',
    'Environmental stewardship',
    'Community values',
    'Future African imaginaries',
  ],
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const competition = await competitionBySlug(slug);
  if (!competition) {
    return slug === 'tales-from-the-baobab'
      ? { title: BAOBAB_FALLBACK.name, description: BAOBAB_FALLBACK.tagline }
      : {};
  }
  return { title: competition.name, description: competition.tagline || undefined };
}

export default async function ProgrammePage({ params }: Props) {
  const { slug } = await params;
  const competition = await competitionBySlug(slug);

  // The Baobab page must exist from launch day, even before the first
  // competition record is created in the admin console.
  if (!competition && slug !== 'tales-from-the-baobab') notFound();

  const name = competition?.name ?? BAOBAB_FALLBACK.name;
  const tagline = competition?.tagline || BAOBAB_FALLBACK.tagline;
  const themes = competition?.themes?.length ? competition.themes : BAOBAB_FALLBACK.themes;
  const isOpen = competition?.status === 'open';

  return (
    <>
      <section className="texture-weave bg-forest-950">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <Eyebrow className="text-gold-400">Programme</Eyebrow>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <h1 className="font-display text-4xl font-semibold text-bone sm:text-5xl">{name}</h1>
            {competition && (
              <Badge tone={isOpen ? 'good' : 'neutral'}>
                {isOpen ? 'Open for entries' : (competition.status as string)}
              </Badge>
            )}
          </div>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-bone/75">{tagline}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href={competition ? `/submit?competition=${competition.slug}` : '/submit'} variant="gold" size="lg">
              {isOpen ? 'Enter the competition' : 'Start an entry'}
            </ButtonLink>
            <ButtonLink
              href="/policies/submissions"
              variant="inverse"
              size="lg"
            >
              Read the submission rules
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_20rem] lg:gap-16 lg:py-20">
        <div className="min-w-0">
          {competition?.description && (
            <p className="font-display text-xl leading-relaxed text-forest-800">{competition.description}</p>
          )}

          <section className="mt-12">
            <SectionHeading eyebrow="Themes" title="What to write about" />
            <p className="mt-4 max-w-2xl leading-relaxed text-muted">
              The programme deliberately emphasises authentic African perspectives rather than
              externally imposed narratives. We are not only looking for technically proficient
              writers. We are looking for voices worth hearing.
            </p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {themes.map((t) => (
                <li key={t} className="flex gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-gold-500" />
                  <span className="text-forest-800">{t}</span>
                </li>
              ))}
            </ul>
          </section>

          {competition?.eligibility_html && (
            <section className="mt-14">
              <SectionHeading eyebrow="Eligibility" title="Who can enter" />
              <div
                className="prose-dpg mt-5"
                dangerouslySetInnerHTML={{ __html: competition.eligibility_html }}
              />
            </section>
          )}

          {competition?.rules_html && (
            <section className="mt-14">
              <SectionHeading eyebrow="Rules" title="The entry rules" />
              <div className="prose-dpg mt-5" dangerouslySetInnerHTML={{ __html: competition.rules_html }} />
              <p className="mt-6 text-xs text-muted">
                Rules version {competition.rules_version}. The version you accept is recorded with
                your submission.
              </p>
            </section>
          )}

          {competition?.faq && competition.faq.length > 0 && (
            <section className="mt-14">
              <SectionHeading eyebrow="Questions" title="Frequently asked" />
              <dl className="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
                {competition.faq.map((item, i) => (
                  <div key={i} className="px-6 py-5">
                    <dt className="font-semibold text-forest-900">{item.q}</dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-muted">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {!competition && (
            <Card className="mt-12 border-dashed p-8">
              <p className="font-display text-lg font-semibold text-forest-900">
                Dates for the next edition are being confirmed
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                Full rules, eligibility and the judging rubric are published here as soon as the
                Foundation opens the call for submissions. Subscribe to the newsletter, or start a
                draft now and finish it when entries open.
              </p>
            </Card>
          )}
        </div>

        {/* Deadline, age and the Start button come first on phones. */}
        <aside className="order-first lg:sticky lg:top-24 lg:order-none lg:self-start">
          <Card className="p-6">
            <h2 className="font-display text-lg font-semibold text-forest-900">At a glance</h2>
            <DescList
              rows={[
                ['Status', competition ? (isOpen ? 'Open for entries' : competition.status) : 'Announced soon'],
                [
                  'Age',
                  competition?.max_age
                    ? `${competition.min_age ? `${competition.min_age}–` : 'Up to '}${competition.max_age}`
                    : 'Under 18',
                ],
                [
                  'Length',
                  competition
                    ? `${formatNumber(competition.word_min)}–${formatNumber(competition.word_max)} words`
                    : '500–3,000 words',
                ],
                ['Opens', competition?.opens_at ? formatDate(competition.opens_at) : 'To be announced'],
                ['Closes', competition ? deadlineLabel(competition.closes_at) : 'To be announced'],
                ['Results', competition?.results_at ? formatDate(competition.results_at) : 'To be announced'],
                ['Entries allowed', competition ? String(competition.max_entries) : '1'],
                ['Languages', competition?.languages?.join(', ') || 'English'],
                ['Judging', competition?.blind_judging === false ? 'Named' : 'Blind: judges do not see your name'],
                [
                  'Guardian consent',
                  competition?.requires_guardian_consent === false ? 'Not required' : 'Required for under-18 entrants',
                ],
                ['Formats', '.docx, PDF, RTF or plain text, up to 4 MB'],
              ]}
            />
            <ButtonLink
              href={competition ? `/submit?competition=${competition.slug}` : '/submit'}
              variant="gold"
              className="mt-6 w-full"
            >
              Start my entry
            </ButtonLink>
          </Card>
        </aside>
      </div>
    </>
  );
}
