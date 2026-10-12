import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/Shell';
import { ButtonLink, Card } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { policyStub } from '@/features/marketing/policies';
import { adminPage } from '@/features/admin/queries';
import { PageForm } from '@/features/admin/Forms';

export default async function AdminPolicyPageEditor({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { slug } = await params;
  const { saved } = await searchParams;
  await requireStaff(`/dashboard/admin/content/pages/${encodeURIComponent(slug)}`);

  const [page, stub] = [await adminPage(slug), policyStub(slug)];
  if (!page && !stub) notFound();

  const written = Boolean(page?.body_html.trim());
  const isLive = written && page?.status === 'published';
  const title = page?.title || stub!.title;

  let lead: string;
  if (page && written) {
    const by = page.updated_by_name ? ` by ${page.updated_by_name}` : '';
    lead = `${isLive ? 'Published' : 'Draft'}, version ${page.version}. Last updated ${formatDate(page.updated_at)}${by}.`;
    if (!isLive && stub) lead += ' The site shows the interim description until this is published.';
  } else if (page?.status === 'published') {
    // The public page reads any published row, so with no wording it is empty.
    lead = 'Published without any wording, so the page on the site is empty. Add the wording and save.';
  } else {
    lead = stub
      ? 'Not written yet. Until it is published, the site shows an interim description of what the platform does.'
      : 'Not written yet. This page is not on the site until it has wording and is published.';
  }

  return (
    <>
      <PageHeader
        eyebrow="Website"
        back={{ href: '/dashboard/admin/content/pages', label: 'Policy pages' }}
        title={title}
        lead={lead}
        action={
          // A policy always has a public page (the interim text until it is published).
          isLive || stub ? (
            <ButtonLink
              href={`/policies/${encodeURIComponent(slug)}`}
              variant="outline"
              size="sm"
              className="min-h-10 sm:min-h-0"
            >
              View on the site
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <Card className="p-5 sm:p-7">
          <PageForm
            notice={saved ? `Saved as version ${page?.version ?? 1}.` : undefined}
            page={{
              slug,
              title,
              summary: page?.summary ?? stub?.summary ?? '',
              bodyHtml: page?.body_html ?? '',
              kind: page?.kind ?? 'policy',
              status: page?.status ?? 'published',
              version: page?.version ?? null,
            }}
          />
        </Card>

        {stub && page?.status !== 'published' && (
          <Card>
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="font-display block text-base font-semibold text-forest-900">
                    What the site says now
                  </span>
                  <span className="block text-[13px] text-muted">
                    The interim description, shown until this policy is published.
                  </span>
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z"
                  />
                </svg>
              </summary>
              <ul className="list-disc space-y-2 border-t border-line py-4 pr-5 pl-10 text-sm leading-relaxed text-forest-800">
                {stub.interim.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </details>
          </Card>
        )}
      </div>
    </>
  );
}
