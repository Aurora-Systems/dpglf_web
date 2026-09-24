import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { newsBySlug } from '@/features/marketing/queries';
import { publicUrl } from '@/lib/r2';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await newsBySlug(slug);
  if (!post) return {};
  // The picture doubles as the link preview on WhatsApp, Facebook and the like.
  const image = post.cover_key ? [{ url: publicUrl(post.cover_key), alt: post.cover_alt || post.title }] : undefined;
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, type: 'article', images: image },
    twitter: image ? { card: 'summary_large_image', images: image } : undefined,
  };
}

export default async function NewsPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await newsBySlug(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-20">
      <Link href="/news" className="-my-3 inline-block py-3 text-sm text-gold-700 hover:underline">
        ← All news
      </Link>
      <p className="mt-8 text-sm text-muted">{formatDate(post.published_at)}</p>
      <h1 className="font-display mt-2 text-4xl leading-tight font-semibold text-balance text-forest-900">
        {post.title}
      </h1>
      {post.excerpt && <p className="mt-5 text-lg leading-relaxed text-muted">{post.excerpt}</p>}
      {post.cover_key && (
        // eslint-disable-next-line @next/next/no-img-element -- same-origin /media proxy
        <img
          src={publicUrl(post.cover_key)}
          alt={post.cover_alt}
          className="mt-8 w-full rounded-xl border border-line object-cover"
        />
      )}
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
