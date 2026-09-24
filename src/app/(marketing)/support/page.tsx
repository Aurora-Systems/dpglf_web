import type { Metadata } from 'next';
import { ButtonLink, Card, Eyebrow, SectionHeading } from '@/components/ui';
import { NewsletterForm } from '@/features/marketing/NewsletterForm';

export const metadata: Metadata = {
  title: 'Support DPGLF',
  description:
    'Fund a competition, an anthology edition or the Story Archive, and help turn African youth storytelling into a profession.',
};

const CIRCLES = [
  {
    name: 'Baobab Circle',
    role: 'Entry-level supporters',
    body: 'Regular giving that keeps competitions open and free to enter for young writers across the continent.',
  },
  {
    name: 'Heritage Circle',
    role: 'Patrons',
    body: 'Support directed at archive development and the youth mentorship programme.',
  },
  {
    name: 'Legacy Circle',
    role: 'Major contributors',
    body: 'Long-term sustainability, cultural preservation and the multilingual archive initiative.',
  },
];

const USES = [
  ['Website and platform', 'The submission, judging and archive system that replaces spreadsheets.'],
  ['First anthology production', 'Editorial, design, print and distribution for a Perspectives edition.'],
  ['Archive creation', 'Digitisation, metadata, storage and long-term preservation.'],
  ['Mentor programme launch', 'Recruiting, training and supporting the first cohort of mentors.'],
  ['Marketing', 'Reaching schools and young writers who do not yet know the Foundation exists.'],
];

export default function SupportPage() {
  return (
    <>
      <section className="texture-weave bg-forest-950">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="max-w-3xl">
            <Eyebrow className="text-gold-400">Support</Eyebrow>
            <h1 className="font-display mt-4 text-4xl leading-tight font-semibold text-balance text-bone sm:text-5xl">
              Help publish Africa’s next generation
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-bone/75">
              Storytelling ecosystems do not need factories or fleets. They need talent,
              partnerships and connectivity, which means modest support goes a very long way.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/contact?topic=support" variant="gold" size="lg">
                Talk to us about giving
              </ButtonLink>
              <ButtonLink
                href="/contact?topic=partnership"
                variant="inverse"
                size="lg"
              >
                Corporate sponsorship
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <SectionHeading
          eyebrow="Membership"
          title="Three circles of support"
          lead="Members receive early access to publications, invitations to Foundation events and recognition within our programmes."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {CIRCLES.map((c) => (
            <Card key={c.name} className="flex flex-col p-7">
              <p className="eyebrow text-gold-700">{c.role}</p>
              <h3 className="font-display mt-2 text-2xl font-semibold text-forest-900">{c.name}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{c.body}</p>
              <ButtonLink href="/contact?topic=support" variant="outline" size="sm" className="mt-6 self-start">
                Enquire
              </ButtonLink>
            </Card>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-sm text-muted">
          Online membership and donation payments are not part of this release. Until they are, the
          Foundation arranges giving directly. Get in touch and we will set it up.
        </p>
      </section>

      <section className="bg-parchment py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading eyebrow="Where support goes" title="What funding pays for" />
            <dl className="mt-8 divide-y divide-line">
              {USES.map(([title, body]) => (
                <div key={title} className="py-4">
                  <dt className="font-semibold text-forest-900">{title}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <Card className="p-7">
              <h2 className="font-display text-xl font-semibold text-forest-900">
                Corporate and CSR partnerships
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Telecommunications, banking, technology, hospitality, aviation and publishing
                partners can sponsor a specific anthology, competition, scholarship, workshop
                series, archive project or language initiative, with clear, reportable outcomes.
              </p>
              <ButtonLink href="/contact?topic=partnership" className="mt-6">
                Discuss a sponsorship
              </ButtonLink>
            </Card>

            <Card className="mt-6 bg-forest-900 p-7 text-bone">
              <h2 className="font-display text-xl font-semibold">Follow the work</h2>
              <p className="mt-2 text-sm leading-relaxed text-bone/70">
                Calls for submissions, anthology news and archive milestones.
              </p>
              <NewsletterForm className="mt-5" />
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
