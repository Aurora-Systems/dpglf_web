import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { newsBySlug } from '@/features/marketing/queries';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await newsBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, type: 'article' },
  };
}

export default async function NewsPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await newsBySlug(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-20">
      <Link href="/news" className="text-sm text-gold-700 hover:underline">
        ← All news
      </Link>
      <p className="mt-8 text-sm text-muted">{formatDate(post.published_at)}</p>
      <h1 className="font-display mt-2 text-4xl leading-tight font-semibold text-balance text-forest-900">
        {post.title}
      </h1>
      {post.excerpt && <p className="mt-5 text-lg leading-relaxed text-muted">{post.excerpt}</p>}
      {post.tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
      )}
      <div className="rule-diamond my-10" aria-hidden />
      <div className="prose-dpg" dangerouslySetInnerHTML={{ __html: post.body_html }} />
    </article>
  );
}
