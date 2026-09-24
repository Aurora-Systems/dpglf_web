import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, Badge, Panel, Table, Td, Th } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { publicUrl } from '@/lib/r2';
import { POLICY_STUBS } from '@/features/marketing/policies';
import { adminNews, adminPages } from '@/features/admin/queries';
import { NewsForm, PageForm } from '@/features/admin/Forms';

export default async function AdminContentPage() {
  await requireStaff('/dashboard/admin/content');
  const [news, pages] = await Promise.all([adminNews(), adminPages()]);

  const published = new Set(pages.map((p) => p.slug));
  const missingPolicies = POLICY_STUBS.filter((p) => !published.has(p.slug));

  return (
    <>
      <PageHeader
        title="Site content"
        lead="News posts and the policy pages. Policies are versioned so a submission can point at the exact wording its writer accepted."
      />

      <div className="space-y-6">
        {missingPolicies.length > 0 && (
          <Alert tone="warning" title={`${missingPolicies.length} policies not yet adopted`}>
            <p>
              {missingPolicies.map((p) => p.title).join(', ')}. The public pages currently show an
              interim description of what the platform does. Publish the approved wording below.
            </p>
          </Alert>
        )}

        <Panel title="Policy and static pages">
          {pages.length > 0 && (
            <Table className="mb-6">
              <thead>
                <tr>
                  <Th>Page</Th>
                  <Th>Kind</Th>
                  <Th>Version</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <Link href={`/policies/${p.slug}`} className="font-medium text-forest-900 hover:text-gold-700">
                        {p.title}
                      </Link>
                      <p className="text-xs text-muted">/{p.slug}</p>
                    </Td>
                    <Td className="text-muted">{p.kind}</Td>
                    <Td className="text-muted">v{p.version}</Td>
                    <Td>
                      <Badge tone={p.status === 'published' ? 'good' : 'neutral'}>{p.status}</Badge>
                    </Td>
                    <Td className="text-xs text-muted">{formatDate(p.updated_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <div className="border-t border-line pt-5">
            <PageForm />
          </div>
        </Panel>

        <Panel title="News posts">
          {news.length > 0 && (
            <Table className="mb-6" min="min-w-0 sm:min-w-[36rem]">
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Status</Th>
                  <Th className="hidden sm:table-cell">Published</Th>
                </tr>
              </thead>
              <tbody>
                {news.map((n) => (
                  <tr key={n.id}>
                    <Td>
                      <div className="flex items-start gap-3">
                        {n.cover_key ? (
                          // eslint-disable-next-line @next/next/no-img-element -- same-origin /media proxy
                          <img
                            src={publicUrl(n.cover_key)}
                            alt=""
                            className="hidden aspect-[16/9] w-20 shrink-0 rounded border border-line object-cover sm:block"
                          />
                        ) : (
                          <span className="hidden aspect-[16/9] w-20 shrink-0 place-items-center rounded border border-dashed border-line text-[10px] text-muted sm:grid">
                            No picture
                          </span>
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/admin/content/news/${n.id}`}
                            className="font-medium text-forest-900 hover:text-gold-700"
                          >
                            {n.title}
                          </Link>
                          <p className="text-xs text-muted">{n.excerpt}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={n.status === 'published' ? 'good' : 'neutral'}>{n.status}</Badge>
                    </Td>
                    <Td className="hidden text-xs text-muted sm:table-cell">{formatDate(n.published_at ?? n.updated_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <div className="border-t border-line pt-5">
            <h3 className="font-display mb-4 text-base font-semibold text-forest-900">Write a new post</h3>
            <NewsForm />
          </div>
        </Panel>
      </div>
    </>
  );
}
