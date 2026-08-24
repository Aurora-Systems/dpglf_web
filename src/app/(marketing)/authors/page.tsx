import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, EmptyState, Eyebrow } from '@/components/ui';
import { initials, truncate } from '@/lib/format';
import { publicAuthors } from '@/features/marketing/queries';

export const metadata: Metadata = {
  title: 'Authors',
  description: 'The writers whose work is preserved in the DPGLF Story Archive.',
};

export default async function AuthorsPage() {
  const authors = await publicAuthors();

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
      <Eyebrow>Authors</Eyebrow>
      <h1 className="font-display mt-3 text-4xl font-semibold text-forest-900 sm:text-5xl">
        The voices in the archive
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">
        A public author profile is opt-in. Writers choose what appears here, and it stays separate
        from their account record.
      </p>

      {authors.length === 0 ? (
        <div className="mt-12">
          <EmptyState title="No public author profiles yet">
            Profiles appear as writers move through publication and choose to make their page
            public.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map((a) => (
            <li key={a.slug}>
              <Card className="relative flex h-full gap-4 p-6 transition-colors hover:border-gold-500">
                <span
                  aria-hidden
                  className="font-display grid size-12 shrink-0 place-items-center rounded-full bg-forest-900 text-bone"
                >
                  {initials(a.pen_name || a.display_name)}
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-lg leading-snug font-semibold text-forest-900">
                    <Link href={`/authors/${a.slug}`} className="before:absolute before:inset-0">
                      {a.pen_name || a.display_name}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {[a.country, `${a.story_count} ${Number(a.story_count) === 1 ? 'story' : 'stories'}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {a.bio && <p className="mt-2 text-sm leading-relaxed text-muted">{truncate(a.bio, 120)}</p>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
