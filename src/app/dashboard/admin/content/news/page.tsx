import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, ButtonLink, EmptyState, Panel } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { publicUrl } from '@/lib/r2';
import { adminNews } from '@/features/admin/queries';

const NEW_POST = '/dashboard/admin/content/news/new';

export default async function AdminNewsPage() {
  await requireStaff('/dashboard/admin/content/news');
  const news = await adminNews();
  const live = news.filter((n) => n.status === 'published').length;
  const drafts = news.length - live;

  const writePost = (
    <ButtonLink href={NEW_POST} variant="gold">
      Write a post
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="News"
        lead="Posts for the news page and the homepage. Only published posts are public."
        action={writePost}
      />

      {news.length === 0 ? (
        <EmptyState title="No posts yet" action={writePost}>
          Announcements, results and stories from the Foundation. A post stays a draft until you
          publish it.
        </EmptyState>
      ) : (
        <Panel
          title="Posts"
          description={`${live} published, ${drafts} ${drafts === 1 ? 'draft' : 'drafts'}`}
        >
          <ul className="divide-y divide-line">
            {news.map((n) => {
              const isLive = n.status === 'published';
              const href = `/dashboard/admin/content/news/${n.id}`;
              return (
                <li key={n.id} className="flex gap-3 py-4 first:pt-1 last:pb-1 sm:gap-4">
                  {n.cover_key ? (
                    // eslint-disable-next-line @next/next/no-img-element -- same-origin /media proxy
                    <img
                      src={publicUrl(n.cover_key)}
                      alt=""
                      className="aspect-[16/9] w-20 shrink-0 self-start rounded-md border border-line object-cover sm:w-32"
                    />
                  ) : (
                    <span className="grid aspect-[16/9] w-20 shrink-0 place-items-center self-start rounded-md border border-dashed border-line bg-parchment text-[10px] text-muted sm:w-32 sm:text-[11px]">
                      No picture
                    </span>
                  )}

                  <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                      <Link
                        href={href}
                        className="font-medium leading-snug text-forest-900 hover:text-gold-700"
                      >
                        {n.title}
                      </Link>
                      {n.excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted">{n.excerpt}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Badge tone={isLive ? 'good' : 'neutral'}>{isLive ? 'Published' : 'Draft'}</Badge>
                        <span className="text-xs text-muted">
                          {isLive
                            ? `Published ${formatDate(n.published_at)}`
                            : `Last edited ${formatDate(n.updated_at)}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {isLive && (
                        <ButtonLink
                          href={`/news/${n.slug}`}
                          variant="ghost"
                          size="sm"
                          className="min-h-10 sm:min-h-0"
                        >
                          View
                        </ButtonLink>
                      )}
                      <ButtonLink href={href} variant="outline" size="sm" className="min-h-10 sm:min-h-0">
                        Edit
                      </ButtonLink>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}
