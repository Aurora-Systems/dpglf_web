import type { Metadata } from 'next';
import Image from 'next/image';
import { StoryCard } from '@/components/site/StoryCard';
import { ButtonLink, Card, Eyebrow, SectionHeading } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { featuredStories } from '@/features/marketing/queries';

export const metadata: Metadata = {
  title: 'Perspectives',
  description:
    'Perspectives: A Collection of Short Stories is the Foundation’s annual anthology, promoting twenty emerging writers alongside established African authors.',
};

const CONTRIBUTORS = [
  'Dr. PLO Lumumba',
  'Joshua Maponga',
  'Petina Gappah',
  'Tsitsi Dangarembga',
  'Chengeto Mayowe',
];

export default async function PerspectivesPage() {
  const stories = await featuredStories(6);

  return (
    <>
      <section className="texture-weave bg-forest-950">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
          <div>
            <Eyebrow className="text-gold-400">Flagship publication</Eyebrow>
            <h1 className="font-display mt-4 text-4xl leading-tight font-semibold text-balance text-bone sm:text-5xl">
              Perspectives: A Collection of Short Stories
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-bone/75">
              An annual anthology that is also a talent incubator. Roughly twenty stories per
              edition, combining young writers with established African authors, intellectuals and
              cultural leaders.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/submit" variant="gold" size="lg">
                Submit for consideration
              </ButtonLink>
              <ButtonLink
                href="/contact?topic=partnership"
                variant="inverse"
                size="lg"
              >
                Register publishing interest
              </ButtonLink>
            </div>
          </div>
          <Image
            src={BRAND.lockupSm}
            alt=""
            width={520}
            height={520}
            className="mx-auto w-full max-w-sm rounded-2xl"
          />
        </div>
      </section>

      {/* ---- the model -------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading eyebrow="The model" title="Twenty authors. One book. One campaign." />
            <p className="mt-6 leading-relaxed text-muted">
              Traditional publishing concentrates everything on a single author and a single title.
              For an unknown young writer, that is a wall. Perspectives inverts it: marketing
              resources concentrate on one carefully curated publication, and an entire cohort of
              writers builds an audience at the same time.
            </p>
            <p className="mt-4 leading-relaxed text-muted">
              Established contributors bring credibility and readership. Emerging writers gain
              exposure that would otherwise take years to build alone. And because the entry ticket
              is a short story rather than a novel, a fifteen-year-old can realistically hold it.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Shared marketing costs', 'One campaign carries twenty writers instead of one.'],
              ['Greater reach', 'Established names bring their audiences with them.'],
              ['Stronger media interest', 'A cohort is a story; a debut short story is not.'],
              ['Thematic breadth', 'Twenty perspectives make a richer book than one voice can.'],
            ].map(([title, body]) => (
              <Card key={title} className="p-5">
                <p className="font-display text-base font-semibold text-forest-900">{title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ---- contributors -------------------------------------------------------- */}
      <section className="bg-parchment py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading
            eyebrow="Contributors"
            title="Emerging voices, in respected company"
            lead="Each edition invites established African thinkers and writers to publish alongside the cohort. Contributors are confirmed edition by edition."
          />
          <ul className="mt-12 flex flex-wrap gap-3">
            {CONTRIBUTORS.map((name) => (
              <li
                key={name}
                className="rounded-full border border-line bg-white px-5 py-2.5 text-sm text-forest-800"
              >
                {name}
              </li>
            ))}
            <li className="rounded-full border border-dashed border-gold-500/60 px-5 py-2.5 text-sm text-gold-700">
              and other prominent African writers
            </li>
          </ul>
          <p className="mt-5 text-xs text-muted">
            Names shown are potential contributors identified in the Foundation’s plan; each
            edition’s line-up is confirmed at publication.
          </p>
        </div>
      </section>

      {/* ---- languages ------------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <SectionHeading
              eyebrow="Multilingual Africa initiative"
              title="Stories lose something in translation. So we plan to keep the originals."
            />
            <p className="mt-6 leading-relaxed text-muted">
              English is the initial publication language. As the archive grows, the Perspectives
              Africa Languages Programme will accept and preserve stories in their original
              languages, contributing to language preservation as well as literary development.
            </p>
          </div>
          <div className="flex flex-wrap content-start gap-2.5">
            {['Shona', 'Ndebele', 'Swahili', 'Yoruba', 'Igbo', 'Zulu', 'Amharic', 'French', 'Portuguese', 'Arabic'].map(
              (lang) => (
                <span
                  key={lang}
                  className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm text-forest-800"
                >
                  {lang}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ---- stories in the anthology ---------------------------------------------- */}
      {stories.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-24">
          <SectionHeading eyebrow="From recent editions" title="Read the work" />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {stories.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
