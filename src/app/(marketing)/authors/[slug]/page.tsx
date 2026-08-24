import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StoryCard } from '@/components/site/StoryCard';
import { Badge, EmptyState, Eyebrow } from '@/components/ui';
import { getSessionUser } from '@/lib/auth';
import { initials, truncate } from '@/lib/format';
import { authorProfile, storiesByAuthor } from '@/features/archive/queries';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const author = await authorProfile(slug);
  if (!author) return {};
  const name = author.pen_name || author.display_name;
  return { title: name, description: truncate(author.bio, 180) || `Stories by ${name}.` };
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  const author = await authorProfile(slug);
  if (!author) notFound();

  const user = await getSessionUser();
  const stories = await storiesByAuthor(user, author.user_id);
  const name = author.pen_name || author.display_name;

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
      <Link href="/authors" className="text-sm text-gold-700 hover:underline">
        ← All authors
      </Link>

      <header className="mt-8 flex flex-wrap items-start gap-6">
        <span
          aria-hidden
          className="font-display grid size-20 shrink-0 place-items-center rounded-full bg-forest-900 text-2xl text-bone"
        >
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <Eyebrow>Author</Eyebrow>
          <h1 className="font-display mt-2 text-4xl font-semibold text-forest-900">{name}</h1>
          <p className="mt-2 text-sm text-muted">
            {[author.country, author.city].filter(Boolean).join(' · ')}
          </p>
          {author.languages?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {author.languages.map((l) => (
                <Badge key={l}>{l}</Badge>
              ))}
            </div>
          )}
        </div>
      </header>

      {author.bio && (
        <div className="prose-dpg mt-10">
          {author.bio.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}

      {author.achievements && (
        <section className="mt-10 max-w-2xl rounded-xl border border-line bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-forest-900">Achievements</h2>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted">
            {author.achievements}
          </p>
        </section>
      )}

      {author.website && (
        <p className="mt-6">
          <a
            href={author.website}
            rel="noopener noreferrer nofollow"
            target="_blank"
            className="text-sm text-gold-700 underline"
          >
            {author.website}
          </a>
        </p>
      )}

      <div className="rule-diamond my-14" aria-hidden />

      <h2 className="font-display text-2xl font-semibold text-forest-900">
        Stories by {name}
      </h2>
      {stories.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No stories are public yet">
            This author’s work is in the archive but not currently listed publicly.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </div>
      )}
    </div>
  );
}
