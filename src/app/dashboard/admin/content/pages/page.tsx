import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, ButtonLink, Panel } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { POLICY_STUBS } from '@/features/marketing/policies';
import { adminPages } from '@/features/admin/queries';

type PageRow = Awaited<ReturnType<typeof adminPages>>[number];

const EDITOR = '/dashboard/admin/content/pages';

/** One line of the list: a policy (written or not) or another page. */
function PageItem({
  slug,
  title,
  page,
  interim = false,
}: {
  slug: string;
  title: string;
  page: PageRow | null;
  /** The site shows a placeholder description until this is published (the five policies). */
  interim?: boolean;
}) {
  const written = Boolean(page?.has_body);
  const isLive = written && page?.status === 'published';
  // Published with no wording: the site shows the row, so an empty page rather than the interim text.
  const blank = Boolean(page && !written && page.status === 'published');
  const href = `${EDITOR}/${encodeURIComponent(slug)}`;

  return (
    <li className="grid gap-x-6 gap-y-3 py-4 first:pt-1 last:pb-1 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center">
      <div className="min-w-0">
        <Link href={href} className="font-medium text-forest-900 hover:text-gold-700">
          {page?.title ?? title}
        </Link>
        <p className="mt-0.5 text-xs text-muted wrap-anywhere">
          /policies/{slug}
          {!interim && page && <span> · {page.kind === 'page' ? 'Page' : 'Policy'}</span>}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:block">
        {page && written ? (
          <Badge tone={isLive ? 'good' : 'neutral'}>
            {isLive ? 'Published' : 'Draft'}, v{page.version}
          </Badge>
        ) : blank ? (
          <Badge tone="bad">Published, no wording</Badge>
        ) : (
          <Badge tone="gold">Not written yet</Badge>
        )}
        <p className="text-xs text-muted sm:mt-1">
          {page && written
            ? `Updated ${formatDate(page.updated_at)}`
            : blank
              ? 'Site shows an empty page'
              : interim
                ? 'Site shows the interim text'
                : 'Not on the site yet'}
        </p>
      </div>

      <ButtonLink
        href={href}
        variant="outline"
        size="sm"
        className="min-h-10 justify-self-start sm:min-h-0 sm:justify-self-end"
      >
        {written ? 'Edit' : 'Write it'}
      </ButtonLink>
    </li>
  );
}

export default async function AdminPolicyPagesPage() {
  await requireStaff('/dashboard/admin/content/pages');
  const pages = await adminPages();

  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const policySlugs = new Set(POLICY_STUBS.map((s) => s.slug));
  const others = pages.filter((p) => !policySlugs.has(p.slug));
  const liveCount = POLICY_STUBS.filter((s) => {
    const p = bySlug.get(s.slug);
    return p?.has_body && p.status === 'published';
  }).length;

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="Policy pages"
        lead="Saving a page publishes a new version. Earlier entries keep the wording their writer accepted."
        action={
          <ButtonLink href={`${EDITOR}/new`} variant="gold">
            Add a page
          </ButtonLink>
        }
      />

      <div className="space-y-6">
        <Panel
          title="Policies"
          description={`${liveCount} of ${POLICY_STUBS.length} published. Until a policy is published, its page on the site shows an interim description of what the platform does.`}
        >
          <ul className="divide-y divide-line">
            {POLICY_STUBS.map((stub) => (
              <PageItem
                key={stub.slug}
                slug={stub.slug}
                title={stub.title}
                page={bySlug.get(stub.slug) ?? null}
                interim
              />
            ))}
          </ul>
        </Panel>

        {others.length > 0 && (
          <Panel title="Other pages" description="Pages added here besides the five policies.">
            <ul className="divide-y divide-line">
              {others.map((p) => (
                <PageItem key={p.id} slug={p.slug} title={p.title} page={p} />
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
