import type { Metadata } from 'next';
import Image from 'next/image';
import { ButtonLink, Card, Eyebrow, RuleDiamond, SectionHeading, Stat } from '@/components/ui';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'About the Foundation',
  description:
    'The Dr. Phillip Gwatidzo Literary Foundation is a hybrid foundation, social enterprise and intellectual property venture building Africa’s youth storytelling ecosystem.',
};

const VALUES = [
  ['Authenticity', 'Preserving and promoting genuine African voices, experiences and perspectives.'],
  ['Excellence', 'Every programme, publication and partnership held to a professional standard.'],
  ['Empowerment', 'Young people treated as creators and future leaders, not beneficiaries.'],
  ['Cultural preservation', 'African stories, languages and knowledge systems documented and safeguarded.'],
  ['Collaboration', 'Impact through partnership between writers, educators, publishers and communities.'],
  ['Sustainability', 'Long-term success needs both social impact and economic viability.'],
];

const LAYERS = [
  {
    name: 'DPGLF Foundation',
    role: 'Public benefit',
    body: 'Competitions, school outreach, mentorship, scholarships, workshops, cultural preservation, research collaboration and archive development.',
    funding: 'Grants, donations, philanthropy, CSR programmes, crowdfunding and development agencies.',
  },
  {
    name: 'DPGLF Creative Studios',
    role: 'Social enterprise',
    body: 'Publishing projects, anthology production, audiobooks, educational products, creative writing courses, cultural consulting and literary events.',
    funding: 'Book sales, digital publications, audiobooks, educational materials, workshops and consulting.',
  },
  {
    name: 'DPGLF IP Ventures',
    role: 'Commercialization',
    body: 'Rights management, adaptation negotiation, production partnerships, licensing, merchandising and international distribution.',
    funding: 'Licensing fees, royalties, production participation, adaptation rights and character licensing.',
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="texture-weave bg-forest-950">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="max-w-3xl">
            <Eyebrow className="text-gold-400">About</Eyebrow>
            <h1 className="font-display mt-4 text-4xl leading-tight font-semibold text-balance text-bone sm:text-5xl">
              Not a literary foundation. An ecosystem builder.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-bone/75">
              DPGLF combines the social mission of a foundation, the sustainability of a social
              enterprise and the growth potential of an intellectual property venture — so that a
              young writer’s first short story can become a published work, a preserved cultural
              record and, in time, an adaptation on screen.
            </p>
          </div>
        </div>
      </section>

      {/* ---- founder --------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="relative">
            <div className="absolute -inset-3 -rotate-1 rounded-3xl bg-gold-100" aria-hidden />
            <Image
              src={BRAND.founder}
              alt="Dr. Phillip Tinashe Gwatidzo"
              width={720}
              height={1080}
              sizes="(max-width: 1024px) 90vw, 34vw"
              className="relative w-full rounded-2xl object-cover"
            />
          </div>
          <div>
            <Eyebrow>The founder</Eyebrow>
            <h2 className="font-display mt-3 text-3xl font-semibold text-forest-900 sm:text-4xl">
              Dr. Phillip Tinashe Gwatidzo
            </h2>
            <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-muted">
              <p>
                A Zimbabwean author, entrepreneur, hospitality consultant and cultural advocate
                whose career spans Africa and Europe, across hospitality management, aviation,
                consultancy and publishing.
              </p>
              <p>
                His literary work grew from a personal commitment: that African children should have
                access to stories reflecting their own histories, traditions and cultural values.
              </p>
              <p>
                <em>Changamire Dombo — The Legend</em> has been incorporated into Zimbabwe’s Advanced
                Level Literature curriculum and is distributed in more than twenty-five countries —
                proof that authentic African storytelling can bridge cultural preservation,
                education and commercial viability at once.
              </p>
              <p>
                The Foundation exists to make that pathway repeatable, at scale, for a whole
                generation of writers.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              <Stat value="25+" label="Countries distributing Changamire Dombo" />
              <Stat value="A-Level" label="Zimbabwe Literature curriculum" />
              <Stat value="2030" label="1,000 writers, 200 stories" />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <RuleDiamond />
      </div>

      {/* ---- vision & mission --------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="bg-forest-900 p-9 text-bone">
            <Eyebrow className="text-gold-400">Vision</Eyebrow>
            <p className="font-display mt-4 text-2xl leading-snug">
              To build Africa’s most influential ecosystem for authentic Afro-inspired storytelling
              — a permanent archive of youth narratives, a new generation of African writers, and
              literary talent turned into sustainable creative careers.
            </p>
          </Card>
          <Card className="bg-emerald-brand p-9 text-bone">
            <Eyebrow className="text-gold-300">Mission</Eyebrow>
            <p className="font-display mt-4 text-2xl leading-snug">
              To identify, nurture, publish, promote and commercialize authentic African youth
              narratives while preserving cultural heritage and creating meaningful economic
              opportunity for young storytellers.
            </p>
          </Card>
        </div>
      </section>

      {/* ---- values --------------------------------------------------------------- */}
      <section className="bg-parchment py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading eyebrow="Core values" title="What the Foundation holds itself to" align="center" />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map(([name, body]) => (
              <Card key={name} className="p-6">
                <h3 className="font-display text-lg font-semibold text-forest-900">{name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ---- three-layer model --------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <SectionHeading
          eyebrow="Structure"
          title="A three-layer hybrid, so mission and sustainability reinforce each other"
          lead="Most literary organisations depend almost entirely on grants. DPGLF was designed from the outset to earn its way toward independence without compromising public benefit."
        />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {LAYERS.map((layer, i) => (
            <Card key={layer.name} className="flex flex-col p-7">
              <div className="flex items-center gap-3">
                <span className="font-display text-2xl font-semibold text-gold-500">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-forest-900">{layer.name}</h3>
                  <p className="text-xs tracking-wider text-gold-700 uppercase">{layer.role}</p>
                </div>
              </div>
              <p className="mt-5 flex-1 text-sm leading-relaxed text-muted">{layer.body}</p>
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-[11px] tracking-wider text-muted uppercase">Revenue</p>
                <p className="mt-1 text-[13px] leading-relaxed text-forest-800">{layer.funding}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card className="mt-10 bg-forest-900 p-9 text-bone">
          <h3 className="font-display text-xl font-semibold">Why the model compounds</h3>
          <p className="mt-3 max-w-3xl leading-relaxed text-bone/75">
            As more stories are published, the archive grows. As the archive grows, adaptation
            opportunities increase. As adaptation opportunities increase, revenues expand. As
            revenues expand, more young writers can be supported. Each layer strengthens the others.
          </p>
        </Card>
      </section>

      {/* ---- 2030 ----------------------------------------------------------------- */}
      <section className="bg-forest-950 py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading eyebrow="Vision 2030" tone="dark" title="Where we intend to be" align="center" />
          <ul className="mx-auto mt-14 grid max-w-4xl gap-x-10 gap-y-4 sm:grid-cols-2">
            {[
              'More than 1,000 young writers supported',
              'More than 200 stories published',
              'Africa’s largest archive of youth-generated narratives',
              'At least 20 adaptation-ready intellectual property assets',
              'Multiple language editions launched',
              'Several animation and screen adaptation projects in development',
              'Partnerships across at least 10 African countries',
              'More than half of annual revenue from earned income and licensing',
            ].map((item) => (
              <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-bone/75">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rotate-45 bg-gold-500" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-14 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/how-it-works" variant="gold">
              How the ecosystem works
            </ButtonLink>
            <ButtonLink
              href="/partners"
              variant="ghost"
              className="border border-bone/25 text-bone hover:border-bone/60 hover:bg-white/6"
            >
              Partner with the Foundation
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
