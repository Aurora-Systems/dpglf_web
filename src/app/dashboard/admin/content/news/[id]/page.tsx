import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/Shell';
import { ButtonLink, Card } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { publicUrl } from '@/lib/r2';
import { htmlToArticle } from '@/lib/richtext';
import { adminNewsPost } from '@/features/admin/queries';
import { NewsForm } from '@/features/admin/Forms';

export default async function AdminNewsPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { created, saved } = await searchParams;
  await requireStaff(`/dashboard/admin/content/news/${id}`);

  const post = await adminNewsPost(id);
  if (!post) notFound();
  const isLive = post.status === 'published';

  return (
    <>
      <PageHeader
        eyebrow="Website"
        back={{ href: '/dashboard/admin/content/news', label: 'News' }}
        title={post.title}
        lead={
          isLive
            ? `Published ${formatDate(post.published_at)}. Last edited ${formatDate(post.updated_at)}.`
            : `Draft, only staff can see it. Last edited ${formatDate(post.updated_at)}.`
        }
        action={
          isLive ? (
            <ButtonLink href={`/news/${post.slug}`} variant="outline" size="sm" className="min-h-10 sm:min-h-0">
              View on the site
            </ButtonLink>
          ) : undefined
        }
      />

      <Card className="p-5 sm:p-7">
        <NewsForm
          notice={
            saved
              ? isLive
                ? 'Saved. The changes are live on the news page.'
                : 'Saved as a draft.'
              : created
                ? isLive
                  ? 'Post created. It is live on the news page now.'
                  : 'Post created as a draft. Set the status to Published when it is ready.'
                : undefined
          }
          key={post.updated_at}
          post={{
            id: post.id,
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt,
            body: htmlToArticle(post.body_html),
            tags: post.tags,
            status: post.status,
            coverUrl: post.cover_key ? publicUrl(post.cover_key) : null,
            coverAlt: post.cover_alt,
          }}
        />
      </Card>
    </>
  );
}
