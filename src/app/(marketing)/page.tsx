import Image from 'next/image';
import Link from 'next/link';
import { IntroVideo } from '@/components/client';
import { StoryCard } from '@/components/site/StoryCard';
import { Badge, ButtonLink, Card, Eyebrow, RuleDiamond, SectionHeading, Stat } from '@/components/ui';
import { BRAND, SITE, STAGES } from '@/lib/brand';
import { deadlineLabel, formatDate, formatNumber } from '@/lib/format';
import {
  featuredCompetition,
  featuredStories,
  impactMetrics,
  latestNews,
  publicPartners,
  siteAnnouncement,
} from '@/features/marketing/queries';

export default async function HomePage() {
  const [competition, stories, metrics, news, partners, announcement] = await Promise.all([
    featuredCompetition(),
    featuredStories(3),
    impactMetrics(),
    latestNews(3),
    publicPartners(),
    siteAnnouncement(),
  ]);

  return (
    <>
      {announcement && (
        <div className="bg-gold-500 px-5 py-2.5 text-center text-sm font-medium text-forest-950">
          {announcement}
        </div>
      )}
      {/* ---- hero -------------------------------------------------------- */}
      <section className="texture-weave relative overflow-hidden bg-forest-950">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-40 size-[38rem] rounded-full bg-emerald-brand/30 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28">
          <div>
            <Eyebrow className="text-gold-400">The DPGLF story ecosystem</Eyebrow>
            <h1 className="font-display mt-5 text-4xl leading-[1.05] font-semibold text-balance text-bone sm:text-5xl lg:text-6xl">
              From Grassroots Narratives to Global Screens
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-bone/75">
              The Dr. Phillip Gwatidzo Literary Foundation discovers young African storytellers,
              mentors them to a professional standard, publishes their work, preserves it in a
              permanent archive — and opens the way to screen and licensing.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/submit" variant="gold" size="lg">
                Submit a story
              </ButtonLink>
              <ButtonLink
                href="/archive"
                size="lg"
                className="border border-bone/25 text-bone hover:border-bone/60 hover:bg-white/6"
                variant="ghost"
              >
                Explore the archive
              </ButtonLink>
            </div>

            <dl className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-8">
              <div>
                <dt className="sr-only">Stages in the ecosystem</dt>
                <dd className="font-display text-3xl font-semibold text-gold-400">Six</dd>
                <p className="mt-1 text-xs text-bone/55">stages, discovery to commercialization</p>
              </div>
              <div>
                <dt className="sr-only">Stories published</dt>
                <dd className="font-display text-3xl font-semibold text-gold-400">
                  {formatNumber(metrics.publishedStories)}
                </dd>
                <p className="mt-1 text-xs text-bone/55">stories published</p>
              </div>
              <div>
                <dt className="sr-only">Vision</dt>
                <dd className="font-display text-3xl font-semibold text-gold-400">2030</dd>
                <p className="mt-1 text-xs text-bone/55">1,000 writers supported</p>
              </div>
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-6 rounded-[2rem] bg-gold-500/8 blur-2xl" aria-hidden />
            <div className="relative grid gap-5 lg:gap-6">
              <IntroVideo
                src={BRAND.introVideo}
                poster={BRAND.introPoster}
                className="aspect-[4/5] w-full"
              />
              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <Image
                  src={BRAND.markSm}
                  alt=""
                  width={64}
                  height={64}
                  className="size-16 shrink-0 rounded-full"
                />
                <div>
                  <p className="text-sm font-semibold text-bone">Dr. Phillip Tinashe Gwatidzo</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-bone/60">
                    Author of <em>Changamire Dombo — The Legend</em>, on Zimbabwe’s A-Level
                    Literature curriculum and distributed in more than twenty-five countries.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- the problem -------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <SectionHeading
            eyebrow="The gap"
            title="Talent is everywhere. The pathway is not."
          />
          <div className="space-y-6 text-[17px] leading-relaxed text-muted">
            <p>
              Africa has the youngest population in the world and one of humanity’s richest
              storytelling traditions. Yet young African writers remain badly underrepresented in
              global publishing, film, television and animation.
            </p>
            <p>
              Most competitions reward talent and stop there. Most publishers expect an 80,000-word
              manuscript before they will invest in editorial support. Between those two facts,
              thousands of promising voices are lost every year.
            </p>
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              {[
                ['No mentorship', 'Talent without technical guidance rarely reaches a publishable standard.'],
                ['No access', 'Limited publishers, thin distribution and few industry networks.'],
                ['No protection', 'Young creators sign away rights they do not understand.'],
                ['No pathway', 'Writing is treated as a hobby, not a profession with a route in.'],
              ].map(([title, body]) => (
                <Card key={title} className="p-5">
                  <p className="font-display text-base font-semibold text-forest-900">{title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- six stages ---------------------------------------------------- */}
      <section className="bg-forest-900 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading
            eyebrow="The ecosystem"
            tone="dark"
            align="center"
            title="One continuous pathway, six stages"
            lead="Musicians move from discovery to recording contracts. Athletes move from grassroots competition to professional leagues. Writers deserve the same structured pathway — so we built it."
          />
          <ol className="mt-16 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((stage) => (
              <li key={stage.key} className="group bg-forest-900 p-7 transition-colors hover:bg-forest-800">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-2xl font-semibold text-gold-500/70">{stage.number}</span>
                  <h3 className="font-display text-xl font-semibold text-bone">{stage.name}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-bone/65">{stage.blurb}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <ButtonLink href="/how-it-works" variant="gold">
              See how a story moves through
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ---- programme spotlight -------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <Eyebrow>Current programme</Eyebrow>
            <h2 className="font-display mt-3 text-3xl leading-tight font-semibold text-forest-900 sm:text-4xl">
              {competition?.name ?? 'Tales from the Baobab'}
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              {competition?.tagline ||
                'An annual Afrocentric short story competition for writers under eighteen — opening in Zimbabwe and widening across Africa and the global African diaspora.'}
            </p>

            <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs tracking-wider text-muted uppercase">Who can enter</dt>
                <dd className="mt-1 text-[15px] text-forest-900">
                  {competition?.max_age
                    ? `Writers ${competition.min_age ? `${competition.min_age}–` : 'up to '}${competition.max_age}`
                    : 'Writers under 18'}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wider text-muted uppercase">Length</dt>
                <dd className="mt-1 text-[15px] text-forest-900">
                  {competition
                    ? `${formatNumber(competition.word_min)}–${formatNumber(competition.word_max)} words`
                    : '500–3,000 words'}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wider text-muted uppercase">Opens</dt>
                <dd className="mt-1 text-[15px] text-forest-900">
                  {competition?.opens_at ? formatDate(competition.opens_at) : 'Announced soon'}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wider text-muted uppercase">Deadline</dt>
                <dd className="mt-1 text-[15px] text-forest-900">
                  {competition ? deadlineLabel(competition.closes_at) : 'Announced soon'}
                </dd>
              </div>
            </dl>

            {competition && competition.themes.length > 0 && (
              <div className="mt-7 flex flex-wrap gap-2">
                {competition.themes.slice(0, 8).map((t) => (
                  <Badge key={t} tone="gold">
                    {t}
                  </Badge>
                ))}
              </div>
            )}

            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href={competition ? `/programmes/${competition.slug}` : '/programmes/tales-from-the-baobab'}>
                Programme details
              </ButtonLink>
              <ButtonLink href="/submit" variant="gold">
                Enter the competition
              </ButtonLink>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-3 rotate-1 rounded-3xl bg-gold-100" aria-hidden />
            <Image
              src={BRAND.founder}
              alt="Dr. Phillip Tinashe Gwatidzo signing a copy of his work"
              width={720}
              height={1080}
              sizes="(max-width: 1024px) 90vw, 40vw"
              className="relative h-full max-h-[34rem] w-full rounded-2xl object-cover"
            />
          </div>
        </div>
      </section>

      {/* ---- featured stories ------------------------------------------------- */}
      <section className="bg-parchment py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              eyebrow="From the archive"
              title="Stories and emerging authors"
              lead="Every approved story is preserved with the cultural and language metadata that makes it findable — by readers, researchers, publishers and producers."
            />
            <ButtonLink href="/archive" variant="outline">
              Browse the archive
            </ButtonLink>
          </div>

          {stories.length > 0 ? (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {stories.map((s) => (
                <StoryCard key={s.id} story={s} />
              ))}
            </div>
          ) : (
            <Card className="mt-12 border-dashed p-10 text-center">
              <p className="font-display text-lg font-semibold text-forest-900">
                The first stories are on their way
              </p>
              <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
                The archive fills as the first cohort moves through judging, mentorship and
                editorial. Subscribe below and we will tell you when it opens.
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* ---- perspectives ---------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="grid gap-12 rounded-3xl bg-forest-950 p-8 sm:p-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:p-16">
          <div>
            <Eyebrow className="text-gold-400">Flagship publication</Eyebrow>
            <h2 className="font-display mt-4 text-3xl leading-tight font-semibold text-bone sm:text-4xl">
              Perspectives: A Collection of Short Stories
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-bone/75">
              Traditional publishing promotes one author, one book, one campaign. Perspectives
              promotes twenty authors through one carefully curated anthology — emerging writers
              published alongside established African authors, intellectuals and cultural leaders.
            </p>
            <ul className="mt-8 space-y-3 text-[15px] text-bone/70">
              {[
                'Roughly twenty stories per annual edition',
                'Established contributors bring credibility and readership',
                'Marketing concentrated on one title instead of scattered across many',
                'A short story, not a novel, is the entry ticket',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rotate-45 bg-gold-500" />
                  {item}
                </li>
              ))}
            </ul>
            <ButtonLink href="/perspectives" variant="gold" className="mt-9">
              Explore Perspectives
            </ButtonLink>
          </div>
          <div className="flex items-center justify-center">
            <Image
              src={BRAND.lockupSm}
              alt=""
              width={420}
              height={420}
              className="w-full max-w-[22rem] rounded-2xl"
            />
          </div>
        </div>
      </section>

      {/* ---- impact ------------------------------------------------------------ */}
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-24">
        <SectionHeading eyebrow="Impact" title="Where the ecosystem stands today" align="center" />
        <div className="mt-12 grid grid-cols-2 gap-8 text-center sm:grid-cols-3 lg:grid-cols-6">
          <Stat value={formatNumber(metrics.submissions)} label="Submissions received" />
          <Stat value={formatNumber(metrics.publishedStories)} label="Stories published" />
          <Stat value={formatNumber(metrics.authors)} label="Authors in the archive" />
          <Stat value={formatNumber(metrics.countries)} label="Countries represented" />
          <Stat value={formatNumber(metrics.mentors)} label="Mentors engaged" />
          <Stat value={formatNumber(metrics.adaptationReady)} label="Adaptation-ready assets" />
        </div>
        <RuleDiamond className="mt-16" />
      </section>

      {/* ---- partners & news ------------------------------------------------------ */}
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <Eyebrow>Partners &amp; supporters</Eyebrow>
            <h2 className="font-display mt-3 text-2xl font-semibold text-forest-900 sm:text-3xl">
              No single organisation builds an ecosystem alone
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              DPGLF coordinates publishers, producers, schools, cultural institutions and funders
              rather than trying to own every stage of the value chain.
            </p>
            {partners.length > 0 ? (
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {partners.slice(0, 8).map((p) => (
                  <li key={p.id} className="rounded-lg border border-line bg-white px-4 py-3">
                    <p className="text-sm font-semibold text-forest-900">{p.name}</p>
                    <p className="mt-0.5 text-xs text-muted capitalize">{p.type.replace('_', ' ')}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {['Emoworld Publishers', 'Bluewalk Productions', 'DreamHaus Productions', 'BAG Animation'].map(
                  (name) => (
                    <li key={name} className="rounded-lg border border-line bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-forest-900">{name}</p>
                      <p className="mt-0.5 text-xs text-muted">Proposed partner</p>
                    </li>
                  ),
                )}
              </ul>
            )}
            <ButtonLink href="/partners" variant="outline" className="mt-8">
              Become a partner
            </ButtonLink>
          </div>

          <div>
            <Eyebrow>Latest</Eyebrow>
            <h2 className="font-display mt-3 text-2xl font-semibold text-forest-900 sm:text-3xl">
              News &amp; announcements
            </h2>
            {news.length > 0 ? (
              <ul className="mt-8 divide-y divide-line">
                {news.map((post) => (
                  <li key={post.id} className="py-5 first:pt-0">
                    <p className="text-xs text-muted">{formatDate(post.published_at)}</p>
                    <h3 className="font-display mt-1 text-lg font-semibold text-forest-900">
                      <Link href={`/news/${post.slug}`} className="hover:text-gold-700">
                        {post.title}
                      </Link>
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{post.excerpt}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-8 rounded-lg border border-dashed border-line bg-white px-5 py-8 text-sm text-muted">
                Announcements, calls for submissions and programme updates will appear here.
              </p>
            )}
            <ButtonLink href="/news" variant="outline" className="mt-8">
              All news
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ---- closing CTA ------------------------------------------------------------ */}
      <section className="bg-emerald-brand">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8">
          <h2 className="font-display text-3xl leading-tight font-semibold text-balance text-bone sm:text-4xl">
            Africa’s stories should be told by Africans, owned by Africans and celebrated by the
            world.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] text-bone/75">
            Whether you write, teach, publish, produce or fund — there is a place for you in the
            ecosystem.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/submit" variant="gold" size="lg">
              Submit a story
            </ButtonLink>
            <ButtonLink
              href="/support"
              size="lg"
              variant="ghost"
              className="border border-bone/30 text-bone hover:border-bone/70 hover:bg-white/8"
            >
              Support {SITE.shortName}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
