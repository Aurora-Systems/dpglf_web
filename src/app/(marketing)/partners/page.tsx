import type { Metadata } from 'next';
import { ButtonLink, Card, Eyebrow, SectionHeading } from '@/components/ui';
import { InquiryForm } from '@/features/marketing/InquiryForm';
import { publicPartners } from '@/features/marketing/queries';

export const metadata: Metadata = {
  title: 'Partners',
  description:
    'Publishing, production, education, cultural and development partnerships that make the DPGLF ecosystem work.',
};

const CATEGORIES = [
  {
    heading: 'Publishing',
    body: 'Editorial support, publishing contracts, print and digital publication, distribution, author representation and revenue participation.',
    named: ['Emoworld Publishers'],
  },
  {
    heading: 'Media & production',
    body: 'Story development, adaptation planning and production capability for animation, television, film and documentary.',
    named: ['Bluewalk Productions', 'DreamHaus Productions', 'BAG Animation'],
  },
  {
    heading: 'Education',
    body: 'Access to emerging writers, workshop platforms, curriculum development and distribution channels for educational content.',
    named: ['Primary and secondary schools', 'Universities', 'Teacher training colleges', 'Educational NGOs'],
  },
  {
    heading: 'Cultural & heritage',
    body: 'Preservation expertise, research collaboration and credibility for the archive as a cultural asset.',
    named: ['National libraries', 'Museums', 'Cultural centres', 'Language preservation initiatives'],
  },
  {
    heading: 'International development',
    body: 'Technical support, funding and international visibility for education, youth development and creative economy work.',
    named: ['UNESCO', 'Goethe-Institut', 'British Council', 'African Culture Fund', 'Mastercard Foundation'],
  },
];

export default async function PartnersPage() {
  const partners = await publicPartners();

  return (
    <>
      <section className="texture-weave bg-forest-950">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="max-w-3xl">
            <Eyebrow className="text-gold-400">Partners</Eyebrow>
            <h1 className="font-display mt-4 text-4xl leading-tight font-semibold text-balance text-bone sm:text-5xl">
              No single organisation builds a continental ecosystem alone
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-bone/75">
              DPGLF is designed as a coordinator, not an owner of every stage. That keeps costs
              down, scales faster, and means our partners’ expertise reaches young writers directly.
            </p>
          </div>
        </div>
      </section>

      {partners.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <SectionHeading eyebrow="Working with us" title="Current partners" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => (
              <Card key={p.id} className="p-6">
                <p className="eyebrow text-gold-700 capitalize">{p.type.replace('_', ' ')}</p>
                <h3 className="font-display mt-2 text-lg font-semibold text-forest-900">{p.name}</h3>
                {p.description && (
                  <p className="mt-2 text-sm leading-relaxed text-muted">{p.description}</p>
                )}
                {p.website && (
                  <a
                    href={p.website}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="mt-3 inline-block text-sm text-gold-700 underline"
                  >
                    Visit website
                  </a>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
        <SectionHeading
          eyebrow="Where partnerships fit"
          title="Five kinds of collaboration"
          lead="Each type of partner unlocks a different part of the pathway and strengthens the Foundation’s case for the next one."
        />
        <div className="mt-12 space-y-5">
          {CATEGORIES.map((c) => (
            <Card key={c.heading} className="grid gap-6 p-7 lg:grid-cols-[14rem_1fr_18rem] lg:items-start">
              <h3 className="font-display text-xl font-semibold text-forest-900">{c.heading}</h3>
              <p className="text-sm leading-relaxed text-muted">{c.body}</p>
              <ul className="space-y-1.5 text-[13.5px] text-forest-800">
                {c.named.map((n) => (
                  <li key={n} className="flex gap-2.5">
                    <span aria-hidden className="mt-1.5 size-1 shrink-0 rotate-45 bg-gold-500" />
                    {n}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted">
          Organisations listed are collaborators and prospective partners identified in the
          Foundation’s plan. Confirmed partnerships appear above as they are signed.
        </p>
      </section>

      {/* ---- mentors ---------------------------------------------------------- */}
      <section id="mentors" className="bg-parchment py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              eyebrow="Mentors and judges"
              title="Give a young writer the guidance you wish you had had"
            />
            <p className="mt-6 leading-relaxed text-muted">
              Mentors work with one or two writers through a documented development cycle covering story
              structure, character, dialogue, editing, research, cultural authenticity and
              intellectual property awareness. Judges read assigned entries and score them against a
              published rubric.
            </p>
            <p className="mt-4 leading-relaxed text-muted">
              Both roles are handled entirely in the platform: you only ever see the work assigned to
              you, feedback stays attached to the version it refers to, and nothing is lost between
              drafts.
            </p>
            <ButtonLink href="/contact?topic=general" className="mt-8">
              Offer to mentor or judge
            </ButtonLink>
          </div>
          <Card className="p-7 sm:p-9">
            <h2 className="font-display text-xl font-semibold text-forest-900">
              Rights, licensing and adaptation enquiries
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Publishers, producers and researchers can register interest in a specific story or in
              the catalogue as a whole.
            </p>
            <div className="mt-6">
              <InquiryForm />
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
