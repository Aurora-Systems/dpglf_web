import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, Eyebrow } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { allNews } from '@/features/marketing/queries';

export const metadata: Metadata = {
  title: 'News',
  description: 'Announcements, calls for submissions and updates from the Foundation.',
};

export default async function NewsPage() {
  const posts = await allNews();

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
      <Eyebrow>News</Eyebrow>
      <h1 className="font-display mt-3 text-4xl font-semibold text-forest-900 sm:text-5xl">
        Announcements and updates
      </h1>

      {posts.length === 0 ? (
        <EmptyState title="Nothing published yet">
          Calls for submissions, programme announcements and archive milestones will appear here.
        </EmptyState>
      ) : (
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Card key={post.id} className="relative flex flex-col p-6 transition-colors hover:border-gold-500">
              <p className="text-xs text-muted">{formatDate(post.published_at)}</p>
              <h2 className="font-display mt-2 text-xl leading-snug font-semibold text-forest-900">
                <Link href={`/news/${post.slug}`} className="before:absolute before:inset-0">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{post.excerpt}</p>
              {post.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {post.tags.slice(0, 3).map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
