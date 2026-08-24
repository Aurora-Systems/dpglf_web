import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Badge, ButtonLink, Card, DescList, Eyebrow } from '@/components/ui';
import { getSessionUser } from '@/lib/auth';
import { formatDate, formatNumber, truncate } from '@/lib/format';
import { canReadFullText } from '@/lib/permissions';
import { htmlToText } from '@/lib/richtext';
import { archiveStory, publicationsForStory, storiesByAuthor } from '@/features/archive/queries';
import { InquiryForm } from '@/features/marketing/InquiryForm';
import { StoryCard } from '@/components/site/StoryCard';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = await archiveStory(await getSessionUser(), slug);
  if (!story) return {};
  return {
    title: story.title,
    description: truncate(story.synopsis, 180),
    openGraph: { title: story.title, description: truncate(story.synopsis, 180), type: 'article' },
  };
}

export default async function StoryPage({ params }: Props) {
  const { slug } = await params;
  const user = await getSessionUser();
  const story = await archiveStory(user, slug);
  if (!story) notFound();

  const [publications, siblings] = await Promise.all([
    publicationsForStory(story.id),
    storiesByAuthor(user, story.author_id).catch(() => []),
  ]);

  const fullText = canReadFullText(user, story.visibility);
  // An excerpt is the opening of the story, capped — never the whole thing.
  const excerpt =
    story.excerpt || (story.body_html ? truncate(htmlToText(story.body_html), 900) : story.synopsis);

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
      <Link href="/archive" className="text-sm text-gold-700 hover:underline">
        ← Back to the archive
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <article className="min-w-0">
          <Eyebrow>
            {[story.country, story.language, story.genre].filter(Boolean).join(' · ') || 'Story Archive'}
          </Eyebrow>
          <h1 className="font-display mt-3 text-4xl leading-tight font-semibold text-balance text-forest-900">
            {story.title}
          </h1>
          {story.author_name && (
            <p className="mt-3 text-lg text-muted">
              by{' '}
              {story.author_slug ? (
                <Link href={`/authors/${story.author_slug}`} className="text-forest-800 underline decoration-gold-500/60 underline-offset-4">
                  {story.author_name}
                </Link>
              ) : (
                <span className="text-forest-800">{story.author_name}</span>
              )}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-1.5">
            {story.themes.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
            {story.adaptation_ready && <Badge tone="gold">Adaptation-ready</Badge>}
          </div>

          <p className="mt-8 font-display text-xl leading-relaxed text-forest-800">{story.synopsis}</p>

          <div className="rule-diamond my-10" aria-hidden />

          {fullText && story.body_html ? (
            <div className="prose-story dropcap" dangerouslySetInnerHTML={{ __html: story.body_html }} />
          ) : (
            <>
              <div className="prose-story">
                <p>{excerpt}</p>
              </div>
              <Card className="mt-8 bg-parchment p-6">
                <p className="font-display text-lg font-semibold text-forest-900">
                  This story is listed as an excerpt
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  The author and the Foundation have chosen to publish the metadata and an opening
                  extract here. Publishers, producers and researchers can request access to the full
                  text.
                </p>
                <ButtonLink href="/partners" variant="outline" size="sm" className="mt-4">
                  Request partner access
                </ButtonLink>
              </Card>
            </>
          )}

          {story.cultural_context && (
            <section className="mt-14">
              <h2 className="font-display text-xl font-semibold text-forest-900">Cultural context</h2>
              <p className="mt-3 leading-relaxed text-muted">{story.cultural_context}</p>
            </section>
          )}

          {story.author_bio && (
            <section className="mt-14 rounded-xl border border-line bg-white p-6">
              <h2 className="font-display text-lg font-semibold text-forest-900">
                About {story.author_name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{story.author_bio}</p>
              {story.author_slug && (
                <Link href={`/authors/${story.author_slug}`} className="mt-3 inline-block text-sm text-gold-700 underline">
                  Read more from this author
                </Link>
              )}
            </section>
          )}
        </article>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <h2 className="font-display text-lg font-semibold text-forest-900">Record</h2>
            <DescList
              rows={[
                ['Language', story.language ?? '—'],
                ['Country', story.country ?? '—'],
                ['Region', story.region ?? '—'],
                ['Genre', story.genre ?? '—'],
                ['Age band', story.age_band?.replace(/_/g, '–') ?? '—'],
                ['Length', story.word_count ? `${formatNumber(story.word_count)} words` : '—'],
                ['Programme', story.competition_name ?? '—'],
                ['Edition', story.edition ?? '—'],
                ['Published', formatDate(story.published_at)],
              ]}
            />
            {story.keywords.length > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="eyebrow text-muted">Keywords</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {story.keywords.map((k) => (
                    <Link key={k} href={`/archive?q=${encodeURIComponent(k)}`}>
                      <Badge>{k}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {publications.length > 0 && (
            <Card className="p-6">
              <h2 className="font-display text-lg font-semibold text-forest-900">Published in</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {publications.map((p) => (
                  <li key={p.id}>
                    <p className="font-medium text-forest-900">{p.title || p.edition || p.publication_type}</p>
                    <p className="text-muted">
                      {[p.publisher, p.edition, formatDate(p.publication_date)].filter(Boolean).join(' · ')}
                    </p>
                    {p.isbn && <p className="text-xs text-muted">ISBN {p.isbn}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="font-display text-lg font-semibold text-forest-900">Rights</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              The author retains copyright in this story. Any licence held by the Foundation is
              recorded separately and does not change because a story has been published.
            </p>
          </Card>

          {story.adaptation_ready && (
            <Card className="bg-forest-900 p-6 text-bone">
              <h2 className="font-display text-lg font-semibold">Adaptation enquiry</h2>
              <p className="mt-2 text-sm leading-relaxed text-bone/70">
                This story has been flagged as adaptation-ready. Register your interest and the
                Foundation’s IP team will respond.
              </p>
              <ButtonLink href={`/partners#mentors`} variant="gold" size="sm" className="mt-4">
                Enquire about this story
              </ButtonLink>
            </Card>
          )}
        </aside>
      </div>

      {siblings.length > 1 && (
        <section className="mt-20">
          <h2 className="font-display text-2xl font-semibold text-forest-900">
            More from {story.author_name}
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {siblings
              .filter((s) => s.id !== story.id)
              .slice(0, 3)
              .map((s) => (
                <StoryCard key={s.id} story={s} />
              ))}
          </div>
        </section>
      )}

      {story.adaptation_ready && (
        <section className="mt-20 rounded-2xl border border-line bg-white p-7 sm:p-9">
          <Alert tone="info" title="Interested in adapting this story?">
            Tell us what you have in mind. Nothing is licensed or optioned without a separate
            agreement, negotiated with the Foundation and agreed with the author.
          </Alert>
          <div className="mt-6">
            <InquiryForm storyId={story.id} storyTitle={story.title} />
          </div>
        </section>
      )}
    </div>
  );
}
